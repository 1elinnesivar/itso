"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { fetchContacts } from "@/lib/records";
import { createClient } from "@/lib/supabase/client";
import { normalizeText } from "@/lib/utils";

export function ContactsOverview() {
  const queryClient = useQueryClient();
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const [search, setSearch] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("contacts-directory-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_people" },
        () => void queryClient.invalidateQueries({ queryKey: ["contacts"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const visibleContacts = useMemo(() => {
    const query = normalizeText(search);
    return [...(contacts.data ?? [])]
      .filter(
        (contact) => !query || normalizeText(contact.display_name).includes(query),
      )
      .sort((left, right) =>
        left.display_name.localeCompare(right.display_name, "tr"),
      );
  }, [contacts.data, search]);

  if (contacts.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Temas sorumluları yükleniyor...
      </div>
    );
  }

  if (contacts.error) {
    return (
      <div className="rounded-lg border border-destructive/40 p-6 text-destructive">
        Temas sorumluları yüklenemedi. Bağlantıyı kontrol edip sayfayı yenileyin.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Temas sorumlusu ara..."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleContacts.map((contact) => (
          <Link
            key={contact.id}
            href={`/contacts/${contact.id}`}
            className="group flex min-h-20 items-center gap-3 rounded-xl border bg-background p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1 break-words font-semibold">
              {contact.display_name}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>

      {!visibleContacts.length && (
        <div className="rounded-lg border p-10 text-center text-muted-foreground">
          Aramanıza uygun temas sorumlusu bulunamadı.
        </div>
      )}
    </div>
  );
}
