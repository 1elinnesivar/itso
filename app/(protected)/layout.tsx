import { AppShell } from "@/components/layout/app-shell";
import { createNhostServerClient } from "@/lib/nhost/server";
import type { Profile } from "@/types/app";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const nhost = await createNhostServerClient();
  const session = nhost.getUserSession();
  const user = session?.user;
  if (!user) {
    return (
      <AppShell
        profile={{ id: "anonymous", display_name: "Ziyaretçi", role: "viewer" }}
        email=""
      >
        {children}
      </AppShell>
    );
  }

  let data: Profile | null = null;
  try {
    const response: any = await nhost.graphql.request({
      query: `query Profile($id: uuid!) { profiles_by_pk(id: $id) { id display_name role } }`,
      variables: { id: user.id },
    });
    data = response.body?.data?.profiles_by_pk ?? null;
  } catch {
    // Keep public records reachable during a transient Auth/GraphQL outage.
    data = null;
  }
  if (!data) {
    return (
      <AppShell
        profile={{ id: "anonymous", display_name: "ZiyaretÃ§i", role: "viewer" }}
        email=""
      >
        {children}
      </AppShell>
    );
  }

  return (
    <AppShell profile={data} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
