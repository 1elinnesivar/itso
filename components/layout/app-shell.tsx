"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ContactRound,
  FileSpreadsheet,
  History,
  LogIn,
  LogOut,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/app";

const roleNames = { admin: "Admin", editor: "Editör", viewer: "Görüntüleyici" };

export function AppShell({
  profile,
  email,
  children,
}: {
  profile: Profile;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAnonymous = profile.id === "anonymous";
  const links = [
    { href: "/records", label: "Kayıtlar", icon: Table2, show: true },
    {
      href: "/contacts",
      label: "Temaslar",
      icon: ContactRound,
      show: profile.role === "admin",
    },
    { href: "/imports", label: "İçe Aktar", icon: FileSpreadsheet, show: profile.role === "admin" },
    { href: "/archive", label: "Arşiv", icon: Archive, show: profile.role === "admin" },
    { href: "/audit", label: "Denetim", icon: History, show: profile.role === "admin" },
  ];

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-5 px-4">
          <Link href="/records" className="mr-auto">
            <span className="font-bold">Mobilya Takip</span>
            <span className="ml-2 hidden text-sm text-muted-foreground sm:inline">İTSO</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.filter((link) => link.show).map((link) => (
              <Button
                key={link.href}
                asChild
                variant={pathname.startsWith(link.href) ? "secondary" : "ghost"}
                size="sm"
              >
                <Link href={link.href}>
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              </Button>
            ))}
          </nav>
          <div className="hidden text-right lg:block">
            <p className="max-w-48 truncate text-xs">{profile.display_name || email}</p>
            <Badge variant="secondary">
              {isAnonymous ? "Salt okunur" : roleNames[profile.role]}
            </Badge>
          </div>
          {isAnonymous ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Admin girişi</span>
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={logout} title="Çıkış yap">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t px-3 py-2 md:hidden">
          {links.filter((link) => link.show).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm",
                pathname.startsWith(link.href) ? "bg-muted font-medium" : "text-muted-foreground",
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1800px] p-4 md:p-6">{children}</main>
    </div>
  );
}
