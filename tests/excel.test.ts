import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  EXCEL_HEADERS,
  parseWorkbook,
  readRowColor,
  recordToExcelRow,
} from "@/lib/excel/records";
import type { FurnitureRecord } from "@/types/app";

const record: FurnitureRecord = {
  id: "00000000-0000-0000-0000-000000000001",
  display_order: 1,
  member_registry_no: "00123",
  trade_registry_no: null,
  profession_group: "MOBİLYA TOP. VE PERAKENDE",
  status: "Faal",
  title: "ÖRNEK MOBİLYA",
  officials: "BİRİNCİ KİŞİ\nİKİNCİ KİŞİ",
  origin: null,
  vote_status: null,
  notes: "Birinci satır\nİkinci satır",
  district: "MAHMUDİYE",
  street: null,
  registered_address: "Örnek adres",
  phone_numbers: "0555 000 00 00\n0224 000 00 00",
  row_color: "yellow",
  version: 1,
  created_at: "2026-01-01T00:00:00Z",
  created_by: null,
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: null,
  deleted_at: null,
  deleted_by: null,
  record_contacts: [
    {
      position: 1,
      contact_person_id: "00000000-0000-0000-0000-000000000002",
      contact_people: {
        id: "00000000-0000-0000-0000-000000000002",
        display_name: "ÖRNEK SORUMLU",
        normalized_name: "örnek sorumlu",
      },
    },
  ],
};

describe("Excel eşleştirmesi", () => {
  it("18 özgün sütunu ve satır sonlarını dışa aktarım satırında korur", () => {
    const row = recordToExcelRow(record);
    expect(Object.keys(row)).toEqual([...EXCEL_HEADERS]);
    expect(row["Üye Sicil No"]).toBe("00123");
    expect(row["TEMAS 1"]).toBe("ÖRNEK SORUMLU");
    expect(row["Telefon Numaraları"]).toContain("\n");
    expect(row.NOTLAR).toBe("Birinci satır\nİkinci satır");
  });

  it("çalışma kitabını doğrular ve metin tanımlayıcılarını korur", async () => {
    const sheet = XLSX.utils.json_to_sheet([recordToExcelRow(record)], {
      header: [...EXCEL_HEADERS],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "MOBİLYA TOP. VE PERAKENDE");
    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
      cellStyles: true,
    }) as ArrayBuffer;
    const file = { arrayBuffer: async () => buffer } as File;
    const parsed = await parseWorkbook(file);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].member_registry_no).toBe("00123");
    expect(parsed[0].contact_names).toEqual(["ÖRNEK SORUMLU"]);
    expect(parsed[0].validation_errors).toEqual([]);
    expect(parsed[0].phone_numbers).toContain("\n");
    expect(parsed[0].row_color).toBeNull();
  });

  it("Excel satır dolgu rengini sınıflandırır", () => {
    const sheet = {
      A2: {
        t: "n",
        v: 1,
        s: { patternType: "solid", fgColor: { rgb: "FFFF00" } },
      },
    } as XLSX.WorkSheet;
    expect(readRowColor(sheet, 2)).toBe("yellow");
  });
});
