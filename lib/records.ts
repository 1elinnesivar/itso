import { createClient, getNhostClient } from "@/lib/nhost/client";
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
  const nhost = getNhostClient();
  const authenticated = Boolean(nhost.getUserSession());
  const deletedFilter = authenticated
    ? includeDeleted
      ? "{deleted_at:{_is_null:false}}"
      : "{deleted_at:{_is_null:true}}"
    : null;
  const actorFields = authenticated
    ? "created_by updated_by deleted_at deleted_by"
    : "";
  const query = `query Records($limit:Int!,$offset:Int!){
    records(${deletedFilter ? `where:${deletedFilter},` : ""}order_by:{display_order:asc},limit:$limit,offset:$offset){
      id display_order member_registry_no trade_registry_no registration_date tax_office_account authority_signature profession_group status title officials origin vote_status notes district street registered_address phone_numbers gift itso_status row_color version created_at updated_at ${actorFields}
    }
    record_contacts { record_id contact_person_id position }
    contact_people { id display_name normalized_name }
  }`;
  const result: FurnitureRecord[] = [];
  const contacts = new Map<string, ContactPerson>();
  let links: Array<{ record_id: string; contact_person_id: string; position: number }> = [];
  for (let offset = 0; ; offset += 1000) {
    const response: any = await nhost.graphql.request({ query, variables: { limit: 1000, offset } });
    if (response.body?.errors?.length) throw new Error(response.body.errors[0].message);
    const page = (response.body?.data?.records ?? []) as FurnitureRecord[];
    if (offset === 0) {
      for (const contact of response.body?.data?.contact_people ?? []) contacts.set(contact.id, contact);
      links = response.body?.data?.record_contacts ?? [];
    }
    result.push(...page);
    if (page.length < 1000) break;
  }
  return result.map((record) => ({
    ...record,
    created_by: record.created_by ?? null,
    updated_by: record.updated_by ?? null,
    deleted_at: record.deleted_at ?? null,
    deleted_by: record.deleted_by ?? null,
    record_contacts: links
      .filter((link) => link.record_id === record.id && contacts.has(link.contact_person_id))
      .map((link) => ({ ...link, contact_people: contacts.get(link.contact_person_id)! }))
      .sort((left, right) => left.position - right.position),
  }));
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
