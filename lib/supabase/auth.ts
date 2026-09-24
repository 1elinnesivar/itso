import { redirect } from "next/navigation";
import type { Profile } from "@/types/app";
import { createClient } from "./server";

export async function requireAdmin(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .single();
  const profile = data as Profile | null;
  if (!profile || profile.role !== "admin") redirect("/records");
  return profile;
}
