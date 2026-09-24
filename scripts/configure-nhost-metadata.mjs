import { readFile } from "node:fs/promises";
import process from "node:process";

const subdomain = "dqftmpnxwgmnppgjqorh";
const region = "eu-central-1";
const source = "default";
const applicationAdminRole = "app_admin";
const tableNames = [
  "profiles",
  "records",
  "contact_people",
  "record_contacts",
  "import_batches",
  "import_rows",
  "audit_logs",
  "legacy_table_snapshots",
  "legacy_table_records",
  "rpc_results",
];
const rpcFunctionNames = [
  "apply_current_roster", "apply_current_roster_from_legacy", "apply_import",
  "archive_current_table", "clear_current_table_without_snapshot",
  "create_legacy_record", "create_record", "get_contact_whatsapp_number",
  "patch_legacy_record", "rename_contact_person", "rename_legacy_contact",
  "restore_record", "set_contact_outreach_status", "set_contact_outreach_urgent",
  "set_contact_whatsapp_number", "set_record_color", "set_record_gift",
  "set_record_itso_status", "soft_delete_legacy_record", "soft_delete_record",
  "stage_import", "update_legacy_record", "update_record", "upsert_contact_person",
].map((name) => `api_${name}`);

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

function table(name) {
  return { schema: "public", name };
}

function metadataOperation(type, tableName, args = {}) {
  return {
    type,
    args: { source, table: table(tableName), ...args },
  };
}

async function request(adminSecret, payload) {
  const response = await fetch(
    `https://${subdomain}.hasura.${region}.nhost.run/v1/metadata`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hasura-admin-secret": adminSecret,
      },
      body: JSON.stringify(payload),
    },
  );
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(body.error ?? `Hasura HTTP ${response.status}`);
  }
  return body;
}

async function main() {
  const env = parseEnv(await readFile(".env.migration.local", "utf8"));
  if (!env.NHOST_ADMIN_SECRET) throw new Error("NHOST_ADMIN_SECRET eksik.");

  const metadata = await request(env.NHOST_ADMIN_SECRET, {
    type: "export_metadata",
    args: {},
  });
  const database = metadata.sources.find((item) => item.name === source);
  if (!database) throw new Error(`Hasura kaynağı bulunamadı: ${source}`);
  const tracked = new Set(
    database.tables.map((item) => `${item.table.schema}.${item.table.name}`),
  );

  const tablesToTrack = tableNames.filter(
    (name) => !tracked.has(`public.${name}`),
  );
  for (const name of tablesToTrack) {
    await request(
      env.NHOST_ADMIN_SECRET,
      metadataOperation("pg_track_table", name),
    );
  }

  const refreshed = await request(env.NHOST_ADMIN_SECRET, {
    type: "export_metadata",
    args: {},
  });
  const refreshedDatabase = refreshed.sources.find((item) => item.name === source);
  const configured = new Map(
    refreshedDatabase.tables.map((item) => [item.table.name, item]),
  );
  const permissionOperations = [];

  for (const tableName of tableNames) {
    const item = configured.get(tableName);
    const selectRoles = new Set(
      (item.select_permissions ?? []).map((entry) => entry.role),
    );
    const insertRoles = new Set(
      (item.insert_permissions ?? []).map((entry) => entry.role),
    );
    const updateRoles = new Set(
      (item.update_permissions ?? []).map((entry) => entry.role),
    );
    const deleteRoles = new Set(
      (item.delete_permissions ?? []).map((entry) => entry.role),
    );

    if (!selectRoles.has(applicationAdminRole)) {
      permissionOperations.push(
        metadataOperation("pg_create_select_permission", tableName, {
          role: applicationAdminRole,
          permission: { columns: "*", filter: {}, allow_aggregations: true },
        }),
      );
    }
    if (!insertRoles.has(applicationAdminRole)) {
      permissionOperations.push(
        metadataOperation("pg_create_insert_permission", tableName, {
          role: applicationAdminRole,
          permission: { columns: "*", check: {} },
        }),
      );
    }
    if (!updateRoles.has(applicationAdminRole)) {
      permissionOperations.push(
        metadataOperation("pg_create_update_permission", tableName, {
          role: applicationAdminRole,
          permission: { columns: "*", filter: {}, check: {} },
        }),
      );
    }
    if (!deleteRoles.has(applicationAdminRole)) {
      permissionOperations.push(
        metadataOperation("pg_create_delete_permission", tableName, {
          role: applicationAdminRole,
          permission: { filter: {} },
        }),
      );
    }
  }

  const publicPermissions = [
    {
      tableName: "records",
      columns: [
        "id",
        "display_order",
        "member_registry_no",
        "trade_registry_no",
        "profession_group",
        "status",
        "title",
        "officials",
        "origin",
        "vote_status",
        "notes",
        "district",
        "street",
        "registered_address",
        "phone_numbers",
        "version",
        "created_at",
        "updated_at",
        "row_color",
        "gift",
        "itso_status",
        "registration_date",
        "tax_office_account",
        "authority_signature",
      ],
      filter: { deleted_at: { _is_null: true } },
    },
    {
      tableName: "contact_people",
      columns: ["id", "display_name", "normalized_name"],
      filter: {},
    },
    {
      tableName: "record_contacts",
      columns: ["record_id", "contact_person_id", "position"],
      filter: {},
    },
  ];

  for (const item of publicPermissions) {
    const existingRoles = new Set(
      (configured.get(item.tableName)?.select_permissions ?? []).map(
        (permission) => permission.role,
      ),
    );
    if (!existingRoles.has("public")) {
      permissionOperations.push(
        metadataOperation("pg_create_select_permission", item.tableName, {
          role: "public",
          permission: {
            columns: item.columns,
            filter: item.filter,
            allow_aggregations: false,
          },
        }),
      );
    }
  }

  if (permissionOperations.length > 0) {
    await request(env.NHOST_ADMIN_SECRET, {
      type: "bulk",
      args: permissionOperations,
    });
  }

  const metadataAfterPermissions = await request(env.NHOST_ADMIN_SECRET, {
    type: "export_metadata",
    args: {},
  });
  const sourceAfterPermissions = metadataAfterPermissions.sources.find(
    (item) => item.name === source,
  );
  const trackedFunctions = new Map(
    (sourceAfterPermissions.functions ?? []).map((item) => [
      item.function.name,
      item,
    ]),
  );
  for (const name of rpcFunctionNames) {
    if (!trackedFunctions.has(name)) {
      await request(env.NHOST_ADMIN_SECRET, {
        type: "pg_track_function",
        args: { source, function: { schema: "public", name } },
      });
    }
  }

  const metadataAfterFunctions = await request(env.NHOST_ADMIN_SECRET, {
    type: "export_metadata",
    args: {},
  });
  const sourceAfterFunctions = metadataAfterFunctions.sources.find(
    (item) => item.name === source,
  );
  for (const name of rpcFunctionNames) {
    const item = (sourceAfterFunctions.functions ?? []).find(
      (entry) => entry.function.name === name,
    );
    const roles = new Set((item?.permissions ?? []).map((entry) => entry.role));
    if (!roles.has(applicationAdminRole)) {
      await request(env.NHOST_ADMIN_SECRET, {
        type: "pg_create_function_permission",
        args: {
          source,
          function: { schema: "public", name },
          role: applicationAdminRole,
        },
      });
    }
  }

  await request(env.NHOST_ADMIN_SECRET, {
    type: "reload_metadata",
    args: { reload_sources: true },
  });
  console.log(`İzlenen uygulama tablosu: ${tableNames.length}`);
  console.log("Public salt-okunur tablolar: records, contact_people, record_contacts");
  console.log("Uygulama yöneticisi rolü: app_admin");
  console.log(`GraphQL RPC fonksiyonu: ${rpcFunctionNames.length}`);
  console.log("NHOST_METADATA_BASARILI");
}

main().catch((error) => {
  console.error(`NHOST_METADATA_HATASI: ${error.message}`);
  process.exitCode = 1;
});
