import { createClient } from "@/lib/supabase/client";
import type {
  ContactPerson,
  FurnitureRecord,
  LegacyTableSnapshot,
  RecordContact,
} from "@/types/app";

interface StoredContact {
  position: number;
  contact_person_id: string;
  display_name: string;
  normalized_name: string;
}

interface LegacyRecordRow {
  record_data: FurnitureRecord;
  contacts: StoredContact[] | null;
  version: number;
}

export async function fetchLegacySnapshots(): Promise<LegacyTableSnapshot[]> {
  const { data, error } = await createClient()
    .from("legacy_table_snapshots")
    .select("id, label, source_file_name, record_count, created_by, created_at")
    .gt("record_count", 0)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LegacyTableSnapshot[];
}

export async function fetchLegacyRecords(
  snapshotId: string,
): Promise<FurnitureRecord[]> {
  const { data, error } = await createClient()
    .from("legacy_table_records")
    .select("record_data, contacts, version")
    .eq("snapshot_id", snapshotId)
    .is("deleted_at", null);
  if (error) throw error;

  return ((data ?? []) as unknown as LegacyRecordRow[])
    .map((row) => {
      const contacts: RecordContact[] = (row.contacts ?? []).map((contact) => ({
        position: contact.position,
        contact_person_id: contact.contact_person_id,
        contact_people: {
          id: contact.contact_person_id,
          display_name: contact.display_name,
          normalized_name: contact.normalized_name,
        },
      }));
      return {
        ...row.record_data,
        version: row.version,
        registration_date: row.record_data.registration_date ?? null,
        tax_office_account: row.record_data.tax_office_account ?? null,
        authority_signature: row.record_data.authority_signature ?? null,
        record_contacts: contacts.sort((left, right) => left.position - right.position),
      };
    })
    .sort((left, right) => left.display_order - right.display_order);
}

export function contactsFromLegacyRecords(
  records: FurnitureRecord[],
): ContactPerson[] {
  const contacts = new Map<string, ContactPerson>();
  records.forEach((record) => {
    record.record_contacts.forEach((link) => {
      contacts.set(link.contact_people.id, link.contact_people);
    });
  });
  return [...contacts.values()].sort((left, right) =>
    left.display_name.localeCompare(right.display_name, "tr"),
  );
}
