"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRecords } from "@/hooks/use-records";
import { parseContactDisplayName } from "@/lib/contacts";
import { downloadContactCompaniesPdf } from "@/lib/pdf/contact-companies";
import { createClient } from "@/lib/supabase/client";
import {
  CONTACT_WHATSAPP_MESSAGE,
  normalizeWhatsAppNumber,
} from "@/lib/whatsapp";

export function ContactProfile({ contactId }: { contactId: string }) {
  const { records, contacts } = useRecords();
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [packageNumber, setPackageNumber] = useState("");
  const [copiedField, setCopiedField] = useState<"number" | "message" | null>(
    null,
  );
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const contact = contacts.data?.find((item) => item.id === contactId);
  const storedWhatsAppNumber = useQuery({
    queryKey: ["contact-whatsapp", contactId],
    queryFn: async () => {
      const { data, error } = await createClient().rpc(
        "get_contact_whatsapp_number",
        { p_id: contactId },
      );
      return error ? null : (data as string | null);
    },
    retry: false,
  });

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
  const effectiveWhatsAppNumber =
    storedWhatsAppNumber.data ?? contactDetails.communicationLines[0] ?? "";
  const communicationLines = contactDetails.communicationLines.length
    ? contactDetails.communicationLines
    : storedWhatsAppNumber.data
      ? [storedWhatsAppNumber.data]
      : [];

  async function copyText(
    value: string,
    field: "number" | "message",
    successMessage: string,
  ) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopiedField(field);
    toast.success(successMessage);
    window.setTimeout(
      () => setCopiedField((current) => (current === field ? null : current)),
      1800,
    );
  }

  function prepareCommunicationPackage(number: string) {
    const normalized = normalizeWhatsAppNumber(number);
    if (!normalized) {
      toast.error("Geçerli bir telefon numarası girin.");
      return false;
    }

    setPackageNumber(normalized);
    setCopiedField(null);
    setPackageDialogOpen(true);
    setDownloading(true);
    void downloadContactCompaniesPdf(contactDetails.name, companies)
      .then(() => {
        toast.success("Paket hazırlandı ve firma PDF’i indirildi.");
      })
      .catch(() => {
        toast.error("Paket açıldı ancak PDF indirilemedi.");
      })
      .finally(() => setDownloading(false));
    return true;
  }

  function startPackage() {
    if (
      effectiveWhatsAppNumber &&
      prepareCommunicationPackage(effectiveWhatsAppNumber)
    ) {
      return;
    }
    setPhoneInput("");
    setPhoneDialogOpen(true);
  }

  async function savePhoneAndPreparePackage() {
    const normalized = normalizeWhatsAppNumber(phoneInput);
    if (!normalized) {
      toast.error("Geçerli bir telefon numarası girin.");
      return;
    }

    setSavingPhone(true);
    const { data, error } = await createClient().rpc(
      "set_contact_whatsapp_number",
      {
        p_id: contactId,
        p_phone: normalized,
      },
    );
    setSavingPhone(false);
    if (error) {
      toast.error("Numara profile kaydedilemedi.");
      return;
    }
    queryClient.setQueryData(["contact-whatsapp", contactId], data as string);
    setPhoneDialogOpen(false);
    prepareCommunicationPackage(normalized);
    toast.success("Telefon numarası profile kaydedildi.");
  }

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
          {communicationLines.length ? (
            <div className="mt-1 space-y-1">
              {communicationLines.map((line, index) => (
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
            Paket penceresinden telefon numarasını ve mesajı ayrı ayrı
            kopyalayabilirsiniz. Firma PDF’i otomatik indirilir.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={startPackage}
          disabled={savingPhone || downloading}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          {effectiveWhatsAppNumber
            ? "İletişim paketini hazırla"
            : "Numara ekle ve paketi hazırla"}
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

      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Telefon numarası ekle</DialogTitle>
            <DialogDescription>
              Numara profile kaydedilecek, paket penceresi açılacak ve firma
              PDF’i indirilecek.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-1.5 text-sm font-medium">
            Telefon numarası
            <Input
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
              placeholder="Örn. 0532 123 45 67"
              inputMode="tel"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void savePhoneAndPreparePackage();
                }
              }}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPhoneDialogOpen(false)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={() => void savePhoneAndPreparePackage()}
              disabled={!phoneInput.trim() || savingPhone || downloading}
            >
              {(savingPhone || downloading) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Kaydet ve paketi hazırla
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>İletişim paketi hazır</DialogTitle>
            <DialogDescription>
              Firma PDF’i indirildi. Aşağıdaki numarayı ve mesajı kopyalayıp
              istediğiniz uygulamada kullanabilirsiniz.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="package-number">
                Telefon numarası
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="package-number"
                  value={packageNumber}
                  readOnly
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void copyText(
                      packageNumber,
                      "number",
                      "Telefon numarası kopyalandı.",
                    )
                  }
                >
                  {copiedField === "number" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Numarayı kopyala
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="package-message">
                Mesaj
              </label>
              <Textarea
                id="package-message"
                value={CONTACT_WHATSAPP_MESSAGE}
                readOnly
                className="min-h-72 resize-y whitespace-pre-wrap"
              />
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() =>
                  void copyText(
                    CONTACT_WHATSAPP_MESSAGE,
                    "message",
                    "Mesaj kopyalandı.",
                  )
                }
              >
                {copiedField === "message" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Mesajı kopyala
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
