import { redirect } from "next/navigation";
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

  const response: any = await nhost.graphql.request({
    query: `query Profile($id: uuid!) { profiles_by_pk(id: $id) { id display_name role } }`,
    variables: { id: user.id },
  });
  const data = response.body?.data?.profiles_by_pk;
  if (!data) redirect("/login");

  return (
    <AppShell profile={data as Profile} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
