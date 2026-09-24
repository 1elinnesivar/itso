import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/app";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .single();
  if (!data) redirect("/login");

  return (
    <AppShell profile={data as Profile} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
