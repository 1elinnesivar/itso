"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  RotateCcw,
  Search,
  Send,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseContactDisplayName } from "@/lib/contacts";
import { fetchContacts } from "@/lib/records";
import { createClient } from "@/lib/supabase/client";
import { normalizeText } from "@/lib/utils";
import type { ContactPerson } from "@/types/app";

export function ContactsOverview() {
  const queryClient = useQueryClient();
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const [search, setSearch] = useState("");
  const updateStatus = useMutation({
    mutationFn: async ({ id, sent }: { id: string; sent: boolean }) => {
      const { data, error } = await createClient().rpc(
        "set_contact_outreach_status",
        {
          p_id: id,
          p_sent: sent,
        },
      );
      if (error) throw error;
      return data as ContactPerson;
    },
    onMutate: async ({ id, sent }) => {
      await queryClient.cancelQueries({ queryKey: ["contacts"] });
      const previous = queryClient.getQueryData<ContactPerson[]>(["contacts"]);
      queryClient.setQueryData<ContactPerson[]>(["contacts"], (current = []) =>
        current.map((contact) =>
          contact.id === id
            ? {
                ...contact,
                outreach_sent_at: sent ? new Date().toISOString() : null,
              }
            : contact,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["contacts"], context.previous);
      }
      toast.error(
        "Gönderim durumu kaydedilemedi. Yeni Supabase migration’ını uyguladığınızdan emin olun.",
      );
    },
    onSuccess: (_data, { sent }) => {
      toast.success(
        sent
          ? "Temas sorumlusu Gönderildi bölümüne taşındı."
          : "Temas sorumlusu Gönderilmedi bölümüne taşındı.",
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

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
        (contact) =>
          !query ||
          normalizeText(parseContactDisplayName(contact.display_name).name).includes(query),
      )
      .sort((left, right) =>
        parseContactDisplayName(left.display_name).name.localeCompare(
          parseContactDisplayName(right.display_name).name,
          "tr",
        ),
      );
  }, [contacts.data, search]);
  const pendingContacts = visibleContacts.filter(
    (contact) => !contact.outreach_sent_at,
  );
  const sentContacts = visibleContacts.filter(
    (contact) => Boolean(contact.outreach_sent_at),
  );

  function ContactSection({
    title,
    description,
    items,
    sent,
  }: {
    title: string;
    description: string;
    items: ContactPerson[];
    sent: boolean;
  }) {
    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {sent ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <Send className="h-5 w-5 text-amber-600" />
          )}
          <h2 className="text-lg font-bold">{title}</h2>
          <Badge variant="secondary">{items.length}</Badge>
          <p className="w-full text-sm text-muted-foreground sm:ml-1 sm:w-auto">
            {description}
          </p>
        </div>

        {items.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((contact) => {
              const isUpdating =
                updateStatus.isPending &&
                updateStatus.variables?.id === contact.id;
              return (
                <article
                  key={contact.id}
                  className="flex min-h-24 flex-col rounded-xl border bg-background p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                >
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1 break-words font-semibold">
                      {parseContactDisplayName(contact.display_name).name}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant={sent ? "ghost" : "outline"}
                    className="mt-2 w-full"
                    disabled={isUpdating}
                    onClick={() =>
                      updateStatus.mutate({ id: contact.id, sent: !sent })
                    }
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : sent ? (
                      <RotateCcw className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {sent ? "Gönderilmedi olarak işaretle" : "Gönderildi işaretle"}
                  </Button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {search
              ? "Bu bölümde aramanıza uygun kişi bulunamadı."
              : sent
                ? "Henüz gönderildi olarak işaretlenen kişi yok."
                : "Gönderilmeyi bekleyen kişi yok."}
          </div>
        )}
      </section>
    );
  }

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

      <ContactSection
        title="Gönderilmedi"
        description="İletişim paketi henüz gönderilmeyen kişiler"
        items={pendingContacts}
        sent={false}
      />

      <ContactSection
        title="Gönderildi"
        description="İletişim paketi gönderilen kişiler"
        items={sentContacts}
        sent
      />
    </div>
  );
}
