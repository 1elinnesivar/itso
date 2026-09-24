import { createClient as createNhostClient } from "@nhost/nhost-js";
import { CookieStorage } from "@nhost/nhost-js/session";
import { getNhostEnv } from "./env";

let client: ReturnType<typeof createNhostClient> | undefined;

function errorFrom(response: any) {
  const message =
    response?.body?.errors?.[0]?.message ??
    response?.body?.message ??
    response?.error?.message ??
    (response?.status >= 400 ? `İstek başarısız (${response.status})` : null);
  return message ? { message, code: response?.body?.errors?.[0]?.extensions?.code } : null;
}

function graphqlLiteral(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(graphqlLiteral).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}:${graphqlLiteral(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

class QueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private fields = "id";
  private where: Record<string, any> = {};
  private orderBy: Record<string, string>[] = [];
  private rowLimit?: number;
  private offset?: number;
  private singleRow = false;

  constructor(private table: string) {}
  select(fields: string) { this.fields = fields; return this; }
  eq(column: string, value: unknown) { this.where[column] = { _eq: value }; return this; }
  gt(column: string, value: unknown) { this.where[column] = { _gt: value }; return this; }
  is(column: string, value: unknown) { this.where[column] = { _is_null: value === null }; return this; }
  not(column: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) this.where[column] = { _is_null: false };
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy.push({ [column]: options?.ascending === false ? "desc" : "asc" });
    return this;
  }
  range(from: number, to: number) { this.offset = from; this.rowLimit = to - from + 1; return this; }
  limit(value: number) { this.rowLimit = value; return this; }
  single() { this.singleRow = true; this.rowLimit = 1; return this; }
  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
  private async execute() {
    const argumentsList = [];
    if (Object.keys(this.where).length) argumentsList.push(`where:${graphqlLiteral(this.where)}`);
    if (this.orderBy.length) {
      argumentsList.push(
        `order_by:[${this.orderBy
          .map((item) => {
            const [column, direction] = Object.entries(item)[0];
            return `{${column}:${direction}}`;
          })
          .join(",")}]`,
      );
    }
    if (this.rowLimit !== undefined) argumentsList.push(`limit:${this.rowLimit}`);
    if (this.offset !== undefined) argumentsList.push(`offset:${this.offset}`);
    const fields = this.fields.split(",").map((field) => field.trim()).filter(Boolean).join(" ");
    const query = `query { ${this.table}${argumentsList.length ? `(${argumentsList.join(",")})` : ""} { ${fields} } }`;
    const response: any = await getNhostClient().graphql.request({ query });
    const error = errorFrom(response);
    const rows = response.body?.data?.[this.table] ?? [];
    return { data: this.singleRow ? rows[0] ?? null : rows, error };
  }
}

export function getNhostClient() {
  if (!client) {
    client = createNhostClient({
      ...getNhostEnv(),
      storage: typeof document === "undefined" ? undefined : new CookieStorage({ secure: location.protocol === "https:" }),
    });
  }
  return client;
}

const noArgumentRpcs = new Set(["archive_current_table", "clear_current_table_without_snapshot"]);

function serializeRpcArgs(args: Record<string, unknown>) {
  const serialized = { ...args };

  // Hasura exposes PostgreSQL uuid[] function arguments as the `_uuid` scalar,
  // so GraphQL expects PostgreSQL's array literal instead of a JSON array.
  if (Array.isArray(serialized.p_contact_ids)) {
    serialized.p_contact_ids = `{${serialized.p_contact_ids.join(",")}}`;
  }

  return serialized;
}

export function createClient() {
  const nhost = getNhostClient();
  return {
    auth: {
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        try {
          const response: any = await nhost.auth.signInEmailPassword({ email, password });
          return { data: response.body?.session ?? null, error: errorFrom(response) };
        } catch (error) {
          return { data: null, error: { message: error instanceof Error ? error.message : "Giriş başarısız." } };
        }
      },
      async getSession() { return { data: { session: nhost.getUserSession() }, error: null }; },
      async getUser() { return { data: { user: nhost.getUserSession()?.user ?? null }, error: null }; },
      async signOut(_options?: { scope?: string }) {
        const session = nhost.getUserSession();
        if (session?.refreshTokenId) await nhost.auth.signOut({ refreshToken: session.refreshTokenId });
        nhost.clearSession();
        return { error: null };
      },
    },
    from(table: string) { return new QueryBuilder(table); },
    async rpc(name: string, args: Record<string, unknown> = {}) {
      const field = `api_${name}`;
      const hasArguments = !noArgumentRpcs.has(name);
      const query = hasArguments
        ? `mutation Rpc($args: ${field}_args!) { ${field}(args: $args) { payload } }`
        : `mutation Rpc { ${field} { payload } }`;
      try {
        const response: any = await nhost.graphql.request({
          query,
          variables: hasArguments ? { args: serializeRpcArgs(args) } : undefined,
        });
        const error = errorFrom(response);
        const result = response.body?.data?.[field]?.[0]?.payload ?? null;
        return { data: result, error };
      } catch (error: any) {
        const graphError = error?.body?.errors?.[0] ?? error;
        return {
          data: null,
          error: {
            message: graphError?.message ?? "İşlem başarısız.",
            code: graphError?.extensions?.code,
          },
        };
      }
    },
  };
}
