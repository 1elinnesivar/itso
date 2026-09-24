import { readFile } from "node:fs/promises";
import process from "node:process";
import { Client } from "pg";

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

async function main() {
  const env = parseEnv(await readFile(".env.migration.local", "utf8"));
  const options = { ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15_000 };
  const source = new Client({ ...options, connectionString: env.SOURCE_DATABASE_URL });
  const target = new Client({ ...options, connectionString: env.TARGET_DATABASE_URL });
  await source.connect();
  await target.connect();

  try {
    const functions = await source.query(`
      select p.proname, pg_get_functiondef(p.oid) definition
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname <> 'handle_new_user'
      order by p.proname, pg_get_function_identity_arguments(p.oid)
    `);
    const priority = new Map([
      ["changed_json_fields", 0],
      ["clean_text", 0],
      ["current_user_role", 0],
      ["normalize_whatsapp_number", 0],
      ["require_role", 1],
      ["can_edit", 2],
      ["audit_contact_change", 3],
      ["audit_record_change", 3],
      ["apply_import_gift", 3],
      ["apply_import_row_color", 3],
    ]);
    functions.rows.sort(
      (left, right) =>
        (priority.get(left.proname) ?? 10) -
        (priority.get(right.proname) ?? 10),
    );
    const triggers = await source.query(`
      select t.tgname, c.relname, pg_get_triggerdef(t.oid, true) definition
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where not t.tgisinternal
        and n.nspname = 'public'
        and c.relname = any($1::text[])
      order by c.relname, t.tgname
    `, [["records", "record_contacts"]]);
    const exposedNames = [
      "apply_current_roster",
      "apply_current_roster_from_legacy",
      "apply_import",
      "archive_current_table",
      "clear_current_table_without_snapshot",
      "create_legacy_record",
      "create_record",
      "get_contact_whatsapp_number",
      "patch_legacy_record",
      "rename_contact_person",
      "rename_legacy_contact",
      "restore_record",
      "set_contact_outreach_status",
      "set_contact_outreach_urgent",
      "set_contact_whatsapp_number",
      "set_record_color",
      "set_record_gift",
      "set_record_itso_status",
      "soft_delete_legacy_record",
      "soft_delete_record",
      "stage_import",
      "update_legacy_record",
      "update_record",
      "upsert_contact_person",
    ];
    const exposedFunctions = await source.query(`
      select p.proname,
             pg_get_function_arguments(p.oid) arguments,
             p.proargnames,
             p.prorettype = 'pg_catalog.void'::regtype as returns_void
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any($1::text[])
      order by p.proname
    `, [exposedNames]);

    await target.query("begin");
    try {
      await target.query(`
        create or replace function auth.uid()
        returns uuid
        language sql
        stable
        as $$
          select nullif(
            coalesce(
              current_setting('request.jwt.claim.sub', true),
              current_setting('request.jwt.claims', true)::jsonb ->> 'x-hasura-user-id',
              current_setting('hasura.user', true)::jsonb ->> 'x-hasura-user-id'
            ),
            ''
          )::uuid
        $$
      `);
      for (const item of functions.rows) await target.query(item.definition);
      for (const item of triggers.rows) {
        await target.query(
          `drop trigger if exists "${item.tgname.replaceAll('"', '""')}" on public."${item.relname.replaceAll('"', '""')}"`,
        );
        await target.query(item.definition);
      }
      await target.query(`
        create table if not exists public.rpc_results (
          payload jsonb
        )
      `);
      for (const item of exposedFunctions.rows) {
        const callArguments = (item.proargnames ?? [])
          .map((name) => `"${name.replaceAll('"', '""')}"`)
          .join(", ");
        const invocation = `public."${item.proname}"(${callArguments})`;
        const body = item.returns_void
          ? `perform ${invocation}; return query select null::jsonb;`
          : `return query select to_jsonb(${invocation});`;
        await target.query(`
          create or replace function public."api_${item.proname}"(${item.arguments})
          returns setof public.rpc_results
          language plpgsql
          volatile
          security invoker
          set search_path = public, auth
          as $wrapper$
          begin
            ${body}
          end
          $wrapper$
        `);
      }
      await target.query("commit");
    } catch (error) {
      await target.query("rollback");
      throw error;
    }

    console.log(`Taşınan PostgreSQL fonksiyonu: ${functions.rowCount}`);
    console.log(`Taşınan audit/import trigger'ı: ${triggers.rowCount}`);
    console.log(`GraphQL RPC sarmalayıcısı: ${exposedFunctions.rowCount}`);
    console.log("NHOST_FUNCTIONS_BASARILI");
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(`NHOST_FUNCTIONS_HATASI: ${error.message}`);
  process.exitCode = 1;
});
