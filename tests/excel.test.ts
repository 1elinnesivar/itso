import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";
import {
  createRecordsWorkbook,
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
  gift: true,
  itso_status: "ONAYLANDI",
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
    expect(row.HEDİYE).toBe("EVET");
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
    expect(parsed[0].gift).toBe(true);
    expect(parsed[0].itso_status).toBeNull();
  });

  it("HEDİYE sütunu olmayan özgün Excel dosyalarını kabul eder", async () => {
    const excelRow = recordToExcelRow(record) as Record<string, unknown>;
    delete excelRow.HEDİYE;
    const originalHeaders = EXCEL_HEADERS.filter((header) => header !== "HEDİYE");
    const sheet = XLSX.utils.json_to_sheet([excelRow], {
      header: originalHeaders,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "MOBİLYA TOP. VE PERAKENDE");
    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    }) as ArrayBuffer;
    const file = { arrayBuffer: async () => buffer } as File;

    const parsed = await parseWorkbook(file);

    expect(parsed[0].gift).toBe(false);
    expect(parsed[0].validation_errors).toEqual([]);
  });

  it("TEMAS 5 ve sonraki sütunları yeniden içe aktarır", async () => {
    const extendedRecord: FurnitureRecord = {
      ...record,
      record_contacts: Array.from({ length: 5 }, (_, index) => ({
        position: index + 1,
        contact_person_id: `00000000-0000-0000-0000-00000000000${index + 2}`,
        contact_people: {
          id: `00000000-0000-0000-0000-00000000000${index + 2}`,
          display_name: `SORUMLU ${index + 1}`,
          normalized_name: `sorumlu ${index + 1}`,
        },
      })),
    };
    const excelRow = recordToExcelRow(extendedRecord);
    const headers = [
      ...EXCEL_HEADERS.slice(0, 13),
      "TEMAS 5",
      ...EXCEL_HEADERS.slice(13),
    ];
    const sheet = XLSX.utils.json_to_sheet([excelRow], { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "MOBİLYA TOP. VE PERAKENDE");
    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    }) as ArrayBuffer;
    const file = { arrayBuffer: async () => buffer } as File;
    const parsed = await parseWorkbook(file);

    expect((excelRow as Record<string, unknown>)["TEMAS 5"]).toBe("SORUMLU 5");
    expect(parsed[0].contact_names).toEqual([
      "SORUMLU 1",
      "SORUMLU 2",
      "SORUMLU 3",
      "SORUMLU 4",
      "SORUMLU 5",
    ]);
  });

  it("başlık tasarımını, kenarlıkları ve satır rengini XLSX dosyasına yazar", () => {
    const workbook = createRecordsWorkbook([record]);
    const sourceSheet = workbook.Sheets["MOBİLYA TOP. VE PERAKENDE"];

    expect(sourceSheet.A1.s.fill.fgColor.rgb).toBe("C0C0C0");
    expect(sourceSheet.A1.s.font.bold).toBe(true);
    expect(sourceSheet.A1.s.border.bottom.style).toBe("thin");
    expect(sourceSheet.A2.s.fill.fgColor.rgb).toBe("FFFF00");
    expect(sourceSheet["!cols"]?.[5].wch).toBe(33.07);

    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
      cellStyles: true,
    }) as ArrayBuffer;
    const writtenWorkbook = XLSX.read(buffer, {
      type: "array",
      cellStyles: true,
    });
    const writtenSheet = writtenWorkbook.Sheets["MOBİLYA TOP. VE PERAKENDE"];

    expect(writtenSheet.A1.s.fgColor.rgb).toBe("C0C0C0");
    expect(writtenSheet.A2.s.fgColor.rgb).toBe("FFFF00");
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

  it("Excel mavi satır dolgu rengini sınıflandırır", () => {
    const sheet = {
      A2: {
        t: "n",
        v: 1,
        s: { patternType: "solid", fgColor: { rgb: "00B0F0" } },
      },
    } as XLSX.WorkSheet;
    expect(readRowColor(sheet, 2)).toBe("blue");
  });
});
