import { describe, expect, it } from "vitest";
import {
  ATTENDED_ELECTION_FILTER_VALUE,
  CURRENT_TABLE_HIDDEN_FIELDS,
  findResponsiblePerson,
  NOT_ATTENDED_ELECTION_FILTER_VALUE,
  recordMatchesElectionFilter,
  recordMatchesResponsibleFilter,
  UNASSIGNED_RESPONSIBLE_FILTER_VALUE,
} from "@/lib/records";
import { recordSchema } from "@/lib/validation/record";
import type { ResponsiblePerson } from "@/types/app";

const people: ResponsiblePerson[] = [
  { id: "p1", display_name: "Nurettin İNCİ", normalized_name: "nurettin inci", sort_order: 1 },
  { id: "p2", display_name: "Barış SERBEST", normalized_name: "barış serbest", sort_order: 2 },
];

describe("Sorumlu kişi filtresi", () => {
  it("seçim yoksa bütün kayıtları gösterir", () => {
    expect(recordMatchesResponsibleFilter({ responsible_person_id: null }, [])).toBe(true);
    expect(recordMatchesResponsibleFilter({ responsible_person_id: "p1" }, [])).toBe(true);
  });

  it("seçilen kişilere göre süzer", () => {
    expect(recordMatchesResponsibleFilter({ responsible_person_id: "p1" }, ["p1"])).toBe(true);
    expect(recordMatchesResponsibleFilter({ responsible_person_id: "p2" }, ["p1"])).toBe(false);
  });

  it("atanmamış kayıtları ayrı seçenekle bulur", () => {
    const filter = [UNASSIGNED_RESPONSIBLE_FILTER_VALUE];
    expect(recordMatchesResponsibleFilter({ responsible_person_id: null }, filter)).toBe(true);
    expect(recordMatchesResponsibleFilter({ responsible_person_id: "p1" }, filter)).toBe(false);
  });

  it("aynı ismi Türkçe büyük/küçük harf farkıyla tekrar eklemez", () => {
    expect(findResponsiblePerson(people, "  nurettin   inci ")?.id).toBe("p1");
    expect(findResponsiblePerson(people, "BARIŞ SERBEST")?.id).toBe("p2");
    expect(findResponsiblePerson(people, "Yeni Kişi")).toBeUndefined();
  });
});

describe("Seçime geldi filtresi", () => {
  it("geldi ve gelmedi seçeneklerini ayırır", () => {
    expect(
      recordMatchesElectionFilter({ attended_election: true }, [ATTENDED_ELECTION_FILTER_VALUE]),
    ).toBe(true);
    expect(
      recordMatchesElectionFilter({ attended_election: false }, [ATTENDED_ELECTION_FILTER_VALUE]),
    ).toBe(false);
    expect(
      recordMatchesElectionFilter({ attended_election: false }, [NOT_ATTENDED_ELECTION_FILTER_VALUE]),
    ).toBe(true);
    expect(recordMatchesElectionFilter({ attended_election: false }, [])).toBe(true);
  });
});

describe("Güncel tablo formu", () => {
  it("gizlenen alanların listesi sabit kalır", () => {
    expect([...CURRENT_TABLE_HIDDEN_FIELDS]).toEqual([
      "registration_date",
      "tax_office_account",
      "authority_signature",
      "district",
      "street",
    ]);
  });

  it("boş sorumlu kişiyi null olarak doğrular", () => {
    const parsed = recordSchema.parse({
      member_registry_no: "1",
      trade_registry_no: "",
      registration_date: "",
      tax_office_account: "",
      authority_signature: "",
      profession_group: "MOBİLYA TOP. VE PERAKENDE",
      status: "Faal",
      title: "ÖRNEK",
      officials: "",
      origin: "",
      vote_status: "",
      notes: "",
      district: "",
      street: "",
      registered_address: "",
      phone_numbers: "",
      gift: false,
      itso_status: "",
      responsible_person_id: "",
      attended_election: true,
    });
    expect(parsed.responsible_person_id).toBeNull();
    expect(parsed.attended_election).toBe(true);
  });
});
