"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2, Pencil, Plus, Search, X } from "lucide-react";
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
import { VOTE_STATUS_OPTIONS } from "@/lib/vote-status";
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
  gift: false,
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
    gift: record.gift ?? false,
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

function ContactCombobox({
  contacts,
  selectedId,
  disabledIds,
  placeholder,
  disabled,
  onChange,
  onEdit,
}: {
  contacts: ContactPerson[];
  selectedId: string;
  disabledIds: string[];
  placeholder: string;
  disabled: boolean;
  onChange: (id: string) => void;
  onEdit: (contact: ContactPerson) => void;
}) {
  const selected = contacts.find((contact) => contact.id === selectedId);
  const [query, setQuery] = useState(selected?.display_name ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selected?.display_name ?? "");
  }, [selected?.display_name]);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return contacts
      .filter(
        (contact) =>
          (!normalized ||
            contact.display_name.toLocaleLowerCase("tr-TR").includes(normalized)) &&
          (!disabledIds.includes(contact.id) || contact.id === selectedId),
      )
      .slice(0, 50);
  }, [contacts, disabledIds, query, selectedId]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input
        className={selectedId && !disabled ? "pl-9 pr-20" : "pl-9"}
        value={query}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
      />
      {selectedId && !disabled && (
        <div className="absolute right-1 top-1 flex">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selected && onEdit(selected)}
            aria-label={`${selected?.display_name ?? placeholder} adını düzenle`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange("");
              setQuery("");
            }}
            aria-label={`${placeholder} seçimini temizle`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {open && !disabled && (
        <div
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-background p-1 shadow-lg"
        >
          {results.map((contact) => (
            <div key={contact.id} className="flex items-center rounded hover:bg-muted">
              <button
                type="button"
                role="option"
                aria-selected={contact.id === selectedId}
                className="flex min-h-10 flex-1 items-center px-3 py-2 text-left text-sm"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(contact.id);
                  setQuery(contact.display_name);
                  setOpen(false);
                }}
              >
                <span className="flex-1">{contact.display_name}</span>
                {contact.id === selectedId && <Check className="h-4 w-4 text-primary" />}
              </button>
              <button
                type="button"
                className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-background"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onEdit(contact);
                }}
                aria-label={`${contact.display_name} adını düzenle`}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ))}
          {!results.length && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Temas sorumlusu bulunamadı.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [contactSlotCount, setContactSlotCount] = useState(4);
  const [newContact, setNewContact] = useState("");
  const [addingContact, setAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactPerson | null>(null);
  const [editingContactName, setEditingContactName] = useState("");
  const [renamingContact, setRenamingContact] = useState(false);
  const [initialVersion, setInitialVersion] = useState<number | null>(null);
  const [conflict, setConflict] = useState(false);
  const form = useForm<RecordFormValues, unknown, RecordParsedValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(record ? valuesFromRecord(record) : emptyValues);
    const recordContactIds = record
      ? [...record.record_contacts]
          .sort((a, b) => a.position - b.position)
          .map((item) => item.contact_person_id)
      : [];
    setContactIds(recordContactIds);
    setContactSlotCount(Math.max(4, recordContactIds.length));
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
    if (!contactIds.includes(person.id)) {
      setContactIds([...contactIds, person.id]);
      setContactSlotCount((current) => Math.max(current, contactIds.length + 1));
    }
    setNewContact("");
  }

  function openContactEditor(contact: ContactPerson) {
    setEditingContact(contact);
    setEditingContactName(contact.display_name);
  }

  async function renameContact() {
    if (!editingContact || !editingContactName.trim()) return;
    setRenamingContact(true);
    const { error } = await createClient().rpc("rename_contact_person", {
      p_id: editingContact.id,
      p_expected_name: editingContact.display_name,
      p_display_name: editingContactName,
    });
    setRenamingContact(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Bu adla kayıtlı başka bir temas sorumlusu var."
          : error.code === "40001"
              ? "Bu isim başka bir kullanıcı tarafından değiştirildi. Listeyi yenileyip tekrar deneyin."
              : "Temas sorumlusunun adı güncellenemedi.",
      );
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["contacts"] }),
      queryClient.invalidateQueries({ queryKey: ["records"] }),
    ]);
    toast.success("Temas sorumlusunun adı güncellendi.");
    setEditingContact(null);
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
    <>
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
                {field.name === "vote_status" ? (
                  <select
                    className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    {...form.register("vote_status")}
                  >
                    <option value="">Seçiniz</option>
                    {VOTE_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input {...form.register(field.name)} />
                )}
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
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border bg-background px-3 text-sm font-medium sm:col-span-2">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border accent-primary"
                {...form.register("gift")}
              />
              Hediye
            </label>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Temas sorumluları</p>
                {editable && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setContactSlotCount((current) => current + 1)}
                  >
                    <Plus className="h-4 w-4" />
                    Temas alanı ekle
                  </Button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: contactSlotCount }, (_, index) => (
                  <ContactCombobox
                    key={index}
                    contacts={sortedContacts}
                    selectedId={contactIds[index] ?? ""}
                    disabledIds={contactIds}
                    placeholder={`TEMAS ${index + 1}`}
                    disabled={!editable}
                    onEdit={openContactEditor}
                    onChange={(contactId) => {
                      const next = [...contactIds];
                      if (contactId) next[index] = contactId;
                      else next.splice(index, 1);
                      setContactIds(next.filter(Boolean));
                    }}
                  />
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
      <Dialog
        open={Boolean(editingContact)}
        onOpenChange={(nextOpen) => !nextOpen && setEditingContact(null)}
      >
        <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Temas sorumlusunun adını düzenle</DialogTitle>
          <DialogDescription>
            Bu değişiklik, kişinin bağlı olduğu bütün kayıtlarda uygulanır.
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-1.5 text-sm font-medium">
          Ad soyad
          <Input
            value={editingContactName}
            onChange={(event) => setEditingContactName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void renameContact();
              }
            }}
            autoFocus
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setEditingContact(null)}>
            Vazgeç
          </Button>
          <Button
            type="button"
            onClick={() => void renameContact()}
            disabled={renamingContact || !editingContactName.trim()}
          >
            {renamingContact && <Loader2 className="h-4 w-4 animate-spin" />}
            Adı güncelle
          </Button>
        </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
