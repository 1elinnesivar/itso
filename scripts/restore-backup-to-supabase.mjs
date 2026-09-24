import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

const tableOrder = [
  "records",
  "contact_people",
  "import_batches",
  "legacy_table_snapshots",
  "record_contacts",
  "import_rows",
  "audit_logs",
  "legacy_table_records",
];

const actorColumns = new Set([
  "created_by",
  "updated_by",
  "deleted_by",
  "actor_id",
  "outreach_sent_by",
  "outreach_urgent_by",
]);

const jsonColumns = new Map([
  ["import_batches", new Set(["counts"])],
  ["import_rows", new Set(["data"])],
  ["audit_logs", new Set(["old_data", "new_data"])],
  ["legacy_table_records", new Set(["record_data", "contacts"])],
]);

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function latestBackupFile() {
  const directories = (await readdir(".migration-backups", { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (!directories.length) throw new Error("Yerel migration yedeği bulunamadı.");
  return path.join(
    ".migration-backups",
    directories.at(-1),
    "supabase-public-data.json",
  );
}

function remapActors(row, adminId) {
  return Object.fromEntries(
    Object.entries(row).map(([column, value]) => [
      column,
      actorColumns.has(column) && value !== null ? adminId : value,
    ]),
  );
}

async function insertRows(client, table, rows, adminId) {
  if (!rows.length) return;
  const remapped = rows.map((row) => remapActors(row, adminId));
  const columns = Object.keys(remapped[0]);
  const identityOverride = ["import_rows", "audit_logs"].includes(table)
    ? " overriding system value"
    : "";

  for (let offset = 0; offset < remapped.length; offset += 150) {
    const chunk = remapped.slice(offset, offset + 150);
    const values = [];
    const placeholders = chunk.map((row) => {
      const fields = columns.map((column) => {
        const value = row[column];
        values.push(
          value !== null && jsonColumns.get(table)?.has(column)
            ? JSON.stringify(value)
            : value,
        );
        return `$${values.length}`;
      });
      return `(${fields.join(",")})`;
    });
    await client.query(
      `insert into public.${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(",")})${identityOverride} values ${placeholders.join(",")}`,
      values,
    );
  }
}

async function main() {
  const env = parseEnv(await readFile(".env.migration.local", "utf8"));
  if (!env.NEW_SUPABASE_DATABASE_URL) {
    throw new Error("NEW_SUPABASE_DATABASE_URL eksik.");
  }
  const backupFile = await latestBackupFile();
  const backup = JSON.parse(await readFile(backupFile, "utf8"));
  const client = new Client({
    connectionString: env.NEW_SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  });
  await client.connect();

  try {
    const users = await client.query("select id from auth.users order by created_at");
    if (users.rowCount !== 1) {
      throw new Error(`Tam olarak bir Auth kullanıcısı bekleniyordu; bulunan: ${users.rowCount}`);
    }
    const adminId = users.rows[0].id;
    const existing = await client.query(
      "select (select count(*) from public.records)::int records, (select count(*) from public.audit_logs)::int audit_logs",
    );
    if (existing.rows[0].records || existing.rows[0].audit_logs) {
      throw new Error("Hedef uygulama tabloları boş değil; geri yükleme durduruldu.");
    }

    await client.query("begin");
    try {
      await client.query("alter table public.records disable trigger user");
      await client.query("alter table public.record_contacts disable trigger user");
      await client.query(
        "update public.profiles set role = 'admin', display_name = 'Admin', updated_at = now() where id = $1",
        [adminId],
      );
      for (const table of tableOrder) {
        await insertRows(client, table, backup[table] ?? [], adminId);
      }
      await client.query("alter table public.records enable trigger user");
      await client.query("alter table public.record_contacts enable trigger user");
      await client.query(
        "select setval(pg_get_serial_sequence('public.import_rows','id'), greatest((select coalesce(max(id),1) from public.import_rows),1), true)",
      );
      await client.query(
        "select setval(pg_get_serial_sequence('public.audit_logs','id'), greatest((select coalesce(max(id),1) from public.audit_logs),1), true)",
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    const counts = {};
    for (const table of tableOrder) {
      const result = await client.query(
        `select count(*)::int count from public.${quoteIdentifier(table)}`,
      );
      counts[table] = result.rows[0].count;
      if (counts[table] !== (backup[table] ?? []).length) {
        throw new Error(`${table} sayımı uyuşmuyor.`);
      }
    }
    console.log(JSON.stringify({ backupFile, counts }, null, 2));
    console.log("SUPABASE_RESTORE_OK");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`SUPABASE_RESTORE_ERROR: ${error.message}`);
  process.exitCode = 1;
});
