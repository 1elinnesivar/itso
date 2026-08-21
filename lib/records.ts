import { createClient } from "@/lib/supabase/client";
import type { ContactPerson, FurnitureRecord, Profile } from "@/types/app";

export const UNASSIGNED_CONTACT_FILTER_VALUE = "__unassigned_contact__";

export const RECORD_SELECT = `
  *,
  record_contacts (
    position,
    contact_person_id,
    contact_people (id, display_name, normalized_name)
  )
`;

type PublicRecordRow = Pick<
  FurnitureRecord,
  | "id"
  | "display_order"
  | "profession_group"
  | "status"
  | "title"
  | "district"
  | "gift"
  | "itso_status"
  | "row_color"
  | "version"
  | "updated_at"
>;

export async function fetchAllRecords(includeDeleted = false): Promise<FurnitureRecord[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const { data, error } = await supabase.rpc("get_public_records");
    if (error) throw error;
    return ((data ?? []) as PublicRecordRow[]).map((record) => ({
      id: record.id,
      display_order: record.display_order,
      member_registry_no: "",
      trade_registry_no: null,
      profession_group: record.profession_group,
      status: record.status,
      title: record.title,
      officials: null,
      origin: null,
      vote_status: null,
      notes: null,
      district: record.district,
      street: null,
      registered_address: "",
      phone_numbers: "",
      gift: record.gift ?? false,
      itso_status: record.itso_status ?? null,
      row_color: record.row_color,
      version: record.version,
      created_at: record.updated_at,
      created_by: null,
      updated_at: record.updated_at,
      updated_by: null,
      deleted_at: null,
      deleted_by: null,
      record_contacts: [],
    })) as FurnitureRecord[];
  }

  const pageSize = 750;
  const result: FurnitureRecord[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("records")
      .select(RECORD_SELECT)
      .order("display_order")
      .range(from, from + pageSize - 1);
    query = includeDeleted ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as unknown as FurnitureRecord[];
    result.push(
      ...page.map((record) => ({
        ...record,
        record_contacts: [...(record.record_contacts ?? [])].sort(
          (a, b) => a.position - b.position,
        ),
      })),
    );
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return result;
}

export async function fetchContacts(): Promise<ContactPerson[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from("contact_people")
    .select(
      "id, display_name, normalized_name, outreach_sent_at, outreach_sent_by, outreach_urgent_at, outreach_urgent_by",
    )
    .order("display_name");
  if (!error) return (data ?? []) as ContactPerson[];

  // Acil öncelik migration'ı henüz uygulanmadıysa gönderim durumlarını koru.
  const { data: statusData, error: statusError } = await supabase
    .from("contact_people")
    .select(
      "id, display_name, normalized_name, outreach_sent_at, outreach_sent_by",
    )
    .order("display_name");
  if (!statusError) return (statusData ?? []) as ContactPerson[];

  // Gönderim migration'ı da henüz uygulanmadıysa isim listesi çalışmaya devam
  // eder; durum değiştirme işlemi kullanıcıya migration hatasını gösterir.
  const { data: fallbackData, error: fallbackError } = await supabase
    .from("contact_people")
    .select("id, display_name, normalized_name")
    .order("display_name");
  if (fallbackError) throw fallbackError;
  return (fallbackData ?? []) as ContactPerson[];
}

export async function fetchProfile(): Promise<Profile> {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) {
    return {
      id: "anonymous",
      display_name: "Ziyaretçi",
      role: "viewer",
    };
  }
  const { data, error } = await createClient()
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data as Profile;
}

export function contactsForRecord(record: FurnitureRecord): string[] {
  return [...record.record_contacts]
    .sort((a, b) => a.position - b.position)
    .map((contact) => contact.contact_people?.display_name ?? "");
}

export function recordMatchesContactFilter(
  record: FurnitureRecord,
  selectedContactIds: string[],
): boolean {
  if (!selectedContactIds.length) return true;
  if (
    !record.record_contacts.length &&
    selectedContactIds.includes(UNASSIGNED_CONTACT_FILTER_VALUE)
  ) {
    return true;
  }
  return record.record_contacts.some((contact) =>
    selectedContactIds.includes(contact.contact_person_id),
  );
}
