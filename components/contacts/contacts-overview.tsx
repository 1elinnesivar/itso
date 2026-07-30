"use client";

import { Building2, Loader2, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useRecords } from "@/hooks/use-records";
import { normalizeText } from "@/lib/utils";
import type { FurnitureRecord } from "@/types/app";

interface ContactGroup {
  id: string;
  displayName: string;
  records: FurnitureRecord[];
}

export function ContactsOverview() {
  const { records, contacts } = useRecords();
  const [search, setSearch] = useState("");

  const groups = useMemo<ContactGroup[]>(() => {
    const recordsByContact = new Map<string, FurnitureRecord[]>();

    for (const record of records.data ?? []) {
      for (const contact of record.record_contacts) {
        const current = recordsByContact.get(contact.contact_person_id) ?? [];
        current.push(record);
        recordsByContact.set(contact.contact_person_id, current);
      }
    }

    return (contacts.data ?? [])
      .map((contact) => ({
        id: contact.id,
        displayName: contact.display_name,
        records: (recordsByContact.get(contact.id) ?? []).sort(
          (left, right) =>
            left.display_order - right.display_order ||
            left.title.localeCompare(right.title, "tr"),
        ),
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, "tr"));
  }, [contacts.data, records.data]);

  const visibleGroups = useMemo(() => {
    const query = normalizeText(search);
    if (!query) return groups;

    return groups.flatMap((group) => {
      if (normalizeText(group.displayName).includes(query)) return [group];
      const matchingRecords = group.records.filter((record) =>
        normalizeText(
          [
            record.title,
            record.member_registry_no,
            record.trade_registry_no,
            record.district,
            record.status,
          ].join(" "),
        ).includes(query),
      );
      return matchingRecords.length
        ? [{ ...group, records: matchingRecords }]
        : [];
    });
  }, [groups, search]);

  if (records.isLoading || contacts.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Temas sorumluları yükleniyor...
      </div>
    );
  }

  if (records.error || contacts.error) {
    return (
      <div className="rounded-lg border border-destructive/40 p-6 text-destructive">
        Temas sorumluları yüklenemedi. Bağlantıyı kontrol edip sayfayı yenileyin.
      </div>
    );
  }

  const assignmentCount = groups.reduce(
    (total, group) => total + group.records.length,
    0,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sorumlu, firma, sicil no veya mahalle ara..."
          />
        </div>
        <div className="flex shrink-0 gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{groups.length} sorumlu</Badge>
          <Badge variant="secondary">{assignmentCount} firma bağlantısı</Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        İleride WhatsApp iletişimi ve gönderim durumu bu sorumlu–firma bağlantıları
        üzerinden takip edilebilir.
      </p>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {visibleGroups.map((group) => (
          <article key={group.id} className="overflow-hidden rounded-lg border bg-background">
            <header className="flex items-center gap-3 border-b bg-muted/50 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold">{group.displayName}</h2>
                <p className="text-sm text-muted-foreground">
                  {group.records.length} firma
                </p>
              </div>
            </header>

            {group.records.length ? (
              <ol className="divide-y">
                {group.records.map((record) => (
                  <li key={record.id} className="flex gap-3 p-4">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{record.title}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Sıra: {record.display_order}</span>
                        <span>Üye Sicil: {record.member_registry_no}</span>
                        {record.district && <span>{record.district}</span>}
                      </div>
                    </div>
                    <Badge
                      className="h-fit shrink-0"
                      variant={record.status === "Faal" ? "default" : "secondary"}
                    >
                      {record.status}
                    </Badge>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="p-5 text-sm text-muted-foreground">
                Bu sorumluya bağlı aktif firma bulunmuyor.
              </p>
            )}
          </article>
        ))}
      </div>

      {!visibleGroups.length && (
        <div className="rounded-lg border p-10 text-center text-muted-foreground">
          Aramanıza uygun temas sorumlusu veya firma bulunamadı.
        </div>
      )}
    </div>
  );
}
