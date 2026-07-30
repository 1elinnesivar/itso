export type AppRole = "admin" | "editor" | "viewer";
export type RowColor = "yellow" | "green" | "red" | null;

export interface ContactPerson {
  id: string;
  display_name: string;
  normalized_name: string;
  outreach_sent_at?: string | null;
  outreach_sent_by?: string | null;
  outreach_urgent_at?: string | null;
  outreach_urgent_by?: string | null;
}

export interface RecordContact {
  position: number;
  contact_person_id: string;
  contact_people: ContactPerson;
}

export interface FurnitureRecord {
  id: string;
  display_order: number;
  member_registry_no: string;
  trade_registry_no: string | null;
  profession_group: string;
  status: string;
  title: string;
  officials: string | null;
  origin: string | null;
  vote_status: string | null;
  notes: string | null;
  district: string | null;
  street: string | null;
  registered_address: string;
  phone_numbers: string;
  row_color: RowColor;
  version: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  record_contacts: RecordContact[];
}

export type RecordPayload = Omit<
  FurnitureRecord,
  | "id"
  | "display_order"
  | "version"
  | "created_at"
  | "created_by"
  | "updated_at"
  | "updated_by"
  | "deleted_at"
  | "deleted_by"
  | "record_contacts"
>;

export interface Profile {
  id: string;
  display_name: string | null;
  role: AppRole;
}

export interface AuditLog {
  id: number;
  record_id: string;
  action: "insert" | "update" | "delete" | "restore" | "import";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[];
  actor_id: string | null;
  version_from: number | null;
  version_to: number | null;
  created_at: string;
}
