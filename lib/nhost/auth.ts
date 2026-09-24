import { redirect } from "next/navigation";
import type { Profile } from "@/types/app";
import { createNhostServerClient } from "./server";

export async function requireAdmin(): Promise<Profile> {
  const nhost = await createNhostServerClient();
  const session = nhost.getUserSession();
  if (!session?.user) redirect("/login");
  const response: any = await nhost.graphql.request({
    query: `query Profile($id: uuid!) { profiles_by_pk(id: $id) { id display_name role } }`,
    variables: { id: session.user.id },
  });
  const profile = response.body?.data?.profiles_by_pk as Profile | null;
  if (!profile || profile.role !== "admin") redirect("/records");
  return profile;
}
