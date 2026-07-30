"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
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
import { fetchAllRecords, fetchContacts } from "@/lib/records";
import { createClient } from "@/lib/supabase/client";
import { normalizeText } from "@/lib/utils";
import type { ContactPerson } from "@/types/app";

type SectionKind = "urgent" | "pending" | "sent";

export function ContactsOverview() {
  const queryClient = useQueryClient();
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const records = useQuery({
    queryKey: ["records"],
    queryFn: () => fetchAllRecords(false),
  });
  const [search, setSearch] = useState("");

  const updateStatus = useMutation({
    mutationFn: async ({ id, sent }: { id: string; sent: boolean }) => {
      const { data, error } = await createClient().rpc(
        "set_contact_outreach_status",
        { p_id: id, p_sent: sent },
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
                outreach_urgent_at: sent
                  ? null
                  : contact.outreach_urgent_at,
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
        "Gönderim durumu kaydedilemedi. Supabase migration’larının uygulandığından emin olun.",
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

  const updateUrgency = useMutation({
    mutationFn: async ({ id, urgent }: { id: string; urgent: boolean }) => {
      const { data, error } = await createClient().rpc(
        "set_contact_outreach_urgent",
        { p_id: id, p_urgent: urgent },
      );
      if (error) throw error;
      return data as ContactPerson;
    },
    onMutate: async ({ id, urgent }) => {
      await queryClient.cancelQueries({ queryKey: ["contacts"] });
      const previous = queryClient.getQueryData<ContactPerson[]>(["contacts"]);
      queryClient.setQueryData<ContactPerson[]>(["contacts"], (current = []) =>
        current.map((contact) =>
          contact.id === id
            ? {
                ...contact,
                outreach_urgent_at: urgent ? new Date().toISOString() : null,
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
        "Acil durumu kaydedilemedi. Yeni Supabase migration’ını uyguladığınızdan emin olun.",
      );
    },
    onSuccess: (_data, { urgent }) => {
      toast.success(
        urgent
          ? "Temas sorumlusu Acil gönderilecek bölümüne taşındı."
          : "Temas sorumlusu Gönderilmedi bölümüne taşındı.",
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  useEffect(() => {
    const supabase = createClient();
    const refreshContacts = () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    };
    const refreshRecords = () => {
      void queryClient.invalidateQueries({ queryKey: ["records"] });
    };
    const channel = supabase
      .channel("contacts-directory-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_people" },
        refreshContacts,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "record_contacts" },
        refreshRecords,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "records" },
        refreshRecords,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const companyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of records.data ?? []) {
      for (const link of record.record_contacts) {
        counts.set(
          link.contact_person_id,
          (counts.get(link.contact_person_id) ?? 0) + 1,
        );
      }
    }
    return counts;
  }, [records.data]);

  const visibleContacts = useMemo(() => {
    const query = normalizeText(search);
    return [...(contacts.data ?? [])]
      .filter(
        (contact) =>
          !query ||
          normalizeText(
            parseContactDisplayName(contact.display_name).name,
          ).includes(query),
      )
      .sort((left, right) =>
        parseContactDisplayName(left.display_name).name.localeCompare(
          parseContactDisplayName(right.display_name).name,
          "tr",
        ),
      );
  }, [contacts.data, search]);

  const urgentContacts = visibleContacts.filter(
    (contact) => !contact.outreach_sent_at && contact.outreach_urgent_at,
  );
  const pendingContacts = visibleContacts.filter(
    (contact) => !contact.outreach_sent_at && !contact.outreach_urgent_at,
  );
  const sentContacts = visibleContacts.filter((contact) =>
    Boolean(contact.outreach_sent_at),
  );

  function ContactSection({
    title,
    description,
    items,
    kind,
  }: {
    title: string;
    description: string;
    items: ContactPerson[];
    kind: SectionKind;
  }) {
    const isUrgent = kind === "urgent";
    const isSent = kind === "sent";

    return (
      <section
        className={
          isUrgent
            ? "space-y-3 rounded-2xl border border-red-300 bg-red-50/70 p-4"
            : "space-y-3"
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {isUrgent ? (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          ) : isSent ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <Send className="h-5 w-5 text-amber-600" />
          )}
          <h2 className={isUrgent ? "text-lg font-bold text-red-700" : "text-lg font-bold"}>
            {title}
          </h2>
          <Badge variant={isUrgent ? "destructive" : "secondary"}>
            {items.length}
          </Badge>
          <p
            className={
              isUrgent
                ? "w-full text-sm text-red-700/80 sm:ml-1 sm:w-auto"
                : "w-full text-sm text-muted-foreground sm:ml-1 sm:w-auto"
            }
          >
            {description}
          </p>
        </div>

        {items.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((contact) => {
              const isUpdating =
                (updateStatus.isPending &&
                  updateStatus.variables?.id === contact.id) ||
                (updateUrgency.isPending &&
                  updateUrgency.variables?.id === contact.id);
              const companyCount = companyCounts.get(contact.id) ?? 0;

              return (
                <article
                  key={contact.id}
                  className={
                    isUrgent
                      ? "flex min-h-28 flex-col rounded-xl border border-red-200 bg-background p-3 shadow-sm transition hover:border-red-400 hover:shadow-md"
                      : "flex min-h-28 flex-col rounded-xl border bg-background p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                  }
                >
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1"
                  >
                    <span
                      className={
                        isUrgent
                          ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700"
                          : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                      }
                    >
                      <UserRound className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-semibold">
                        {parseContactDisplayName(contact.display_name).name}
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                        {companyCount} firma
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </Link>

                  {isSent ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mt-2 w-full"
                      disabled={isUpdating}
                      onClick={() =>
                        updateStatus.mutate({ id: contact.id, sent: false })
                      }
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Gönderilmedi olarak işaretle
                    </Button>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isUrgent ? "outline" : "destructive"}
                        disabled={isUpdating}
                        onClick={() =>
                          updateUrgency.mutate({
                            id: contact.id,
                            urgent: !isUrgent,
                          })
                        }
                      >
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isUrgent ? (
                          <RotateCcw className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                        {isUrgent ? "Acili kaldır" : "Acil"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isUpdating}
                        onClick={() =>
                          updateStatus.mutate({ id: contact.id, sent: true })
                        }
                      >
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Gönderildi
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div
            className={
              isUrgent
                ? "rounded-lg border border-dashed border-red-300 bg-background/70 p-7 text-center text-sm text-red-700/80"
                : "rounded-lg border border-dashed p-7 text-center text-sm text-muted-foreground"
            }
          >
            {search
              ? "Bu bölümde aramanıza uygun kişi bulunamadı."
              : isUrgent
                ? "Acil gönderilecek kişi yok."
                : isSent
                  ? "Henüz gönderildi olarak işaretlenen kişi yok."
                  : "Gönderilmeyi bekleyen kişi yok."}
          </div>
        )}
      </section>
    );
  }

  if (contacts.isLoading || records.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Temas sorumluları yükleniyor...
      </div>
    );
  }

  if (contacts.error || records.error) {
    return (
      <div className="rounded-lg border border-destructive/40 p-6 text-destructive">
        Temas sorumluları yüklenemedi. Bağlantıyı kontrol edip sayfayı yenileyin.
      </div>
    );
  }

  return (
    <div className="space-y-7">
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
        title="Acil gönderilecek"
        description="Öncelikli olarak iletişime geçilecek kişiler"
        items={urgentContacts}
        kind="urgent"
      />

      <ContactSection
        title="Gönderilmedi"
        description="İletişim paketi henüz gönderilmeyen kişiler"
        items={pendingContacts}
        kind="pending"
      />

      <ContactSection
        title="Gönderildi"
        description="İletişim paketi gönderilen kişiler"
        items={sentContacts}
        kind="sent"
      />
    </div>
  );
}
