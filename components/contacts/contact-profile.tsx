"use client";

import {
  ArrowLeft,
  Building2,
  Download,
  Loader2,
  MessageCircle,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRecords } from "@/hooks/use-records";
import { parseContactDisplayName } from "@/lib/contacts";
import { downloadContactCompaniesPdf } from "@/lib/pdf/contact-companies";

export function ContactProfile({ contactId }: { contactId: string }) {
  const { records, contacts } = useRecords();
  const [downloading, setDownloading] = useState(false);
  const contact = contacts.data?.find((item) => item.id === contactId);

  const companies = useMemo(
    () =>
      (records.data ?? [])
        .filter((record) =>
          record.record_contacts.some(
            (item) => item.contact_person_id === contactId,
          ),
        )
        .sort(
          (left, right) =>
            left.display_order - right.display_order ||
            left.title.localeCompare(right.title, "tr"),
        ),
    [contactId, records.data],
  );

  if (records.isLoading || contacts.isLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Temas profili yükleniyor...
      </div>
    );
  }

  if (records.error || contacts.error) {
    return (
      <div className="rounded-lg border border-destructive/40 p-6 text-destructive">
        Temas profili yüklenemedi. Sayfayı yenileyip tekrar deneyin.
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="rounded-xl border bg-background p-10 text-center">
        <h1 className="font-semibold">Temas sorumlusu bulunamadı</h1>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/contacts">Temaslara dön</Link>
        </Button>
      </div>
    );
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      await downloadContactCompaniesPdf(
        parseContactDisplayName(contact!.display_name).name,
        companies,
      );
      toast.success("Firma listesi PDF olarak indirildi.");
    } catch {
      toast.error("PDF oluşturulamadı.");
    } finally {
      setDownloading(false);
    }
  }

  const activeCount = companies.filter((record) => record.status === "Faal").length;
  const contactDetails = parseContactDisplayName(contact.display_name);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/contacts">
          <ArrowLeft className="h-4 w-4" />
          Temas sorumlularına dön
        </Link>
      </Button>

      <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <div className="flex flex-col gap-5 px-5 pb-6 sm:px-7">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-background bg-primary text-primary-foreground shadow">
              <UserRound className="h-9 w-9" />
            </span>
            <div className="min-w-0 flex-1 sm:pb-1">
              <p className="text-sm font-medium text-primary">Temas sorumlusu</p>
              <h1 className="break-words text-2xl font-bold">{contactDetails.name}</h1>
            </div>
            <Button
              onClick={() => void downloadPdf()}
              disabled={downloading || !companies.length}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Firma listesini PDF indir
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-muted p-4">
              <p className="text-2xl font-bold">{companies.length}</p>
              <p className="text-sm text-muted-foreground">Toplam firma</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Faal firma</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-2xl font-bold">{companies.length - activeCount}</p>
              <p className="text-sm text-muted-foreground">Askıdaki firma</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-background p-5 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold">İletişim</h2>
          {contactDetails.communicationLines.length ? (
            <div className="mt-1 space-y-1">
              {contactDetails.communicationLines.map((line, index) => (
                <p
                  key={`${line}-${index}`}
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <Phone className="h-4 w-4 text-primary" />
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Bu temas sorumlusu için kayıtlı iletişim numarası bulunmuyor.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            WhatsApp gönderimi ve gönderildi/gönderilmedi takibi sonraki aşamada
            bu profil üzerinden yönetilecek.
          </p>
        </div>
        <Button variant="outline" disabled>
          <MessageCircle className="h-4 w-4" />
          WhatsApp — yakında
        </Button>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Bağlı firmalar</h2>
          <Badge variant="secondary">{companies.length}</Badge>
        </div>

        {companies.length ? (
          <>
            <div className="hidden overflow-hidden rounded-xl border bg-background md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-3">Sıra</th>
                    <th className="p-3">Firma</th>
                    <th className="p-3">Üye Sicil</th>
                    <th className="p-3">Mahalle</th>
                    <th className="p-3">Telefon</th>
                    <th className="p-3">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {companies.map((record) => (
                    <tr key={record.id} className="align-top">
                      <td className="p-3">{record.display_order}</td>
                      <td className="p-3 font-medium">{record.title}</td>
                      <td className="p-3">{record.member_registry_no}</td>
                      <td className="p-3">{record.district || "—"}</td>
                      <td className="whitespace-pre-wrap p-3">
                        {record.phone_numbers || "—"}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={record.status === "Faal" ? "default" : "secondary"}
                        >
                          {record.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {companies.map((record) => (
                <article key={record.id} className="rounded-xl border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Sıra {record.display_order} · Üye Sicil {record.member_registry_no}
                      </p>
                      <h3 className="mt-1 font-semibold">{record.title}</h3>
                    </div>
                    <Badge
                      variant={record.status === "Faal" ? "default" : "secondary"}
                    >
                      {record.status}
                    </Badge>
                  </div>
                  {record.district && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {record.district}
                    </p>
                  )}
                  {record.phone_numbers && (
                    <div className="mt-3 flex gap-2 text-sm">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="whitespace-pre-wrap">{record.phone_numbers}</span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
            Bu sorumluya bağlı aktif firma bulunmuyor.
          </div>
        )}
      </section>
    </div>
  );
}
