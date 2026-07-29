"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { createClient } from "@/lib/supabase/client";
import {
  recordSchema,
  type RecordFormValues,
  type RecordParsedValues,
} from "@/lib/validation/record";
import type { AppRole, ContactPerson, FurnitureRecord } from "@/types/app";

const emptyValues: RecordFormValues = {
  member_registry_no: "",
  trade_registry_no: "",
  profession_group: "MOBİLYA TOP. VE PERAKENDE",
  status: "Faal",
  title: "",
  officials: "",
  origin: "",
  vote_status: "",
  notes: "",
  district: "",
  street: "",
  registered_address: "",
  phone_numbers: "",
};

function valuesFromRecord(record: FurnitureRecord): RecordFormValues {
  return {
    member_registry_no: record.member_registry_no,
    trade_registry_no: record.trade_registry_no ?? "",
    profession_group: record.profession_group,
    status: record.status,
    title: record.title,
    officials: record.officials ?? "",
    origin: record.origin ?? "",
    vote_status: record.vote_status ?? "",
    notes: record.notes ?? "",
    district: record.district ?? "",
    street: record.street ?? "",
    registered_address: record.registered_address,
    phone_numbers: record.phone_numbers,
  };
}

const textFields: Array<{
  name: keyof RecordFormValues;
  label: string;
  required?: boolean;
  full?: boolean;
}> = [
  { name: "member_registry_no", label: "Üye Sicil No", required: true },
  { name: "trade_registry_no", label: "Ticaret Sicil No" },
  { name: "profession_group", label: "Meslek Grubu", required: true, full: true },
  { name: "status", label: "Durumu", required: true },
  { name: "vote_status", label: "Oy Durumu" },
  { name: "title", label: "Unvan", required: true, full: true },
  { name: "origin", label: "Köken" },
  { name: "district", label: "Mahalle" },
  { name: "street", label: "Cadde", full: true },
];

export function RecordFormDialog({
  open,
  onOpenChange,
  record,
  contacts,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: FurnitureRecord | null;
  contacts: ContactPerson[];
  role: AppRole;
}) {
  const editable = role === "admin" || role === "editor";
  const queryClient = useQueryClient();
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [newContact, setNewContact] = useState("");
  const [addingContact, setAddingContact] = useState(false);
  const [initialVersion, setInitialVersion] = useState<number | null>(null);
  const [conflict, setConflict] = useState(false);
  const form = useForm<RecordFormValues, unknown, RecordParsedValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(record ? valuesFromRecord(record) : emptyValues);
    setContactIds(
      record
        ? [...record.record_contacts]
            .sort((a, b) => a.position - b.position)
            .map((item) => item.contact_person_id)
        : [],
    );
    setInitialVersion(record?.version ?? null);
    setConflict(false);
  }, [open, record?.id, form]);

  const remoteChanged = Boolean(
    record && initialVersion !== null && record.version !== initialVersion,
  );
  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => a.display_name.localeCompare(b.display_name, "tr")),
    [contacts],
  );

  async function addContact() {
    if (!newContact.trim()) return;
    setAddingContact(true);
    const { data, error } = await createClient().rpc("upsert_contact_person", {
      p_display_name: newContact,
    });
    setAddingContact(false);
    if (error) {
      toast.error("Temas sorumlusu eklenemedi.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    const person = data as ContactPerson;
    if (contactIds.length < 4 && !contactIds.includes(person.id)) {
      setContactIds([...contactIds, person.id]);
    }
    setNewContact("");
  }

  async function save(values: RecordParsedValues) {
    if (!editable) return;
    if (new Set(contactIds).size !== contactIds.length) {
      toast.error("Aynı temas sorumlusu birden fazla seçilemez.");
      return;
    }
    const payload = values;
    const supabase = createClient();
    const response = record
      ? await supabase.rpc("update_record", {
          p_id: record.id,
          p_expected_version: initialVersion,
          p_payload: payload,
          p_contact_ids: contactIds,
        })
      : await supabase.rpc("create_record", {
          p_payload: payload,
          p_contact_ids: contactIds,
        });

    if (response.error) {
      if (response.error.code === "40001" || response.error.message.includes("VERSION_CONFLICT")) {
        setConflict(true);
        await queryClient.invalidateQueries({ queryKey: ["records"] });
        toast.error("Kayıt başka bir kullanıcı tarafından değiştirildi.");
      } else {
        toast.error(response.error.message.includes("duplicate")
          ? "Sicil numarası başka bir kayıtta kullanılıyor."
          : "Kayıt kaydedilemedi.");
      }
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["records"] });
    toast.success(record ? "Kayıt güncellendi." : "Kayıt eklendi.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{record ? (editable ? "Kaydı düzenle" : "Kayıt ayrıntısı") : "Yeni kayıt"}</DialogTitle>
          <DialogDescription>
            {record ? `Üye Sicil No: ${record.member_registry_no} · Sürüm ${record.version}` : "Yeni kuruluş bilgilerini girin."}
          </DialogDescription>
        </DialogHeader>
        {(remoteChanged || conflict) && (
          <div className="mb-5 flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Kayıt başka bir kullanıcı tarafından güncellendi.</p>
              <p>Değişikliklerinizi kaydetmeden önce pencereyi kapatıp güncel kaydı yeniden açın.</p>
            </div>
          </div>
        )}
        <form className="space-y-5" onSubmit={form.handleSubmit(save)}>
          <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
            {textFields.map((field) => (
              <label
                key={field.name}
                className={`space-y-1.5 text-sm font-medium ${field.full ? "sm:col-span-2" : ""}`}
              >
                {field.label} {field.required && <span className="text-destructive">*</span>}
                <Input {...form.register(field.name)} />
                {form.formState.errors[field.name] && (
                  <span className="text-xs text-destructive">
                    {String(form.formState.errors[field.name]?.message)}
                  </span>
                )}
              </label>
            ))}
            {[
              ["officials", "Yetkililer"],
              ["notes", "Notlar"],
              ["registered_address", "Tescil Adresi"],
              ["phone_numbers", "Telefon Numaraları"],
            ].map(([name, label]) => (
              <label key={name} className="space-y-1.5 text-sm font-medium sm:col-span-2">
                {label}
                <Textarea {...form.register(name as keyof RecordFormValues)} />
              </label>
            ))}
            <div className="space-y-2 sm:col-span-2">
              <p className="text-sm font-medium">Temas sorumluları (en fazla 4)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[0, 1, 2, 3].map((index) => (
                  <select
                    key={index}
                    value={contactIds[index] ?? ""}
                    onChange={(event) => {
                      const next = [...contactIds];
                      if (event.target.value) next[index] = event.target.value;
                      else next.splice(index, 1);
                      setContactIds(next.filter(Boolean).slice(0, 4));
                    }}
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">TEMAS {index + 1}</option>
                    {sortedContacts.map((contact) => (
                      <option
                        key={contact.id}
                        value={contact.id}
                        disabled={contactIds.includes(contact.id) && contactIds[index] !== contact.id}
                      >
                        {contact.display_name}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
              {editable && (
                <div className="flex gap-2">
                  <Input
                    value={newContact}
                    onChange={(event) => setNewContact(event.target.value)}
                    placeholder="Yeni temas sorumlusu"
                  />
                  <Button type="button" variant="outline" onClick={addContact} disabled={addingContact}>
                    {addingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Ekle
                  </Button>
                </div>
              )}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {editable ? "Vazgeç" : "Kapat"}
            </Button>
            {editable && (
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || remoteChanged || conflict}
              >
                {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Kaydet
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
