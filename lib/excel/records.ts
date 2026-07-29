import * as XLSX from "xlsx";
import { contactsForRecord } from "@/lib/records";
import { normalizeLineEndings, normalizeText } from "@/lib/utils";
import type { FurnitureRecord, RecordPayload, RowColor } from "@/types/app";

export const EXCEL_HEADERS = [
  "Sıra",
  "Üye Sicil No",
  "Ticaret Sicil No",
  "Meslek Grubu",
  "Durumu",
  "Unvan",
  "Yetkililer",
  "KÖKEN",
  "OY DURUMU",
  "TEMAS 1",
  "TEMAS 2",
  "TEMAS 3",
  "TEMAS 4",
  "NOTLAR",
  "MAHALLE",
  "CADDE",
  "Tescil Adresi",
  "Telefon Numaraları",
] as const;

export interface ParsedExcelRow extends RecordPayload {
  row_number: number;
  display_order: number;
  contact_names: string[];
  validation_errors: string[];
}

const rowColorToRgb: Record<Exclude<RowColor, null>, string> = {
  yellow: "FFFF00",
  green: "00B050",
  red: "FF0000",
};

export function readRowColor(sheet: XLSX.WorkSheet, rowNumber: number): RowColor {
  const style = sheet[`A${rowNumber}`]?.s as
    | { patternType?: string; fgColor?: { rgb?: string } }
    | undefined;
  if (style?.patternType !== "solid" || !style.fgColor?.rgb) return null;
  const rgb = style.fgColor.rgb.toUpperCase().slice(-6);
  if (rgb === "FFFF00") return "yellow";
  if (rgb === "00B050") return "green";
  if (rgb === "FF0000") return "red";
  return null;
}

export function recordToExcelRow(record: FurnitureRecord) {
  const contacts = contactsForRecord(record);
  return {
    Sıra: record.display_order,
    "Üye Sicil No": record.member_registry_no,
    "Ticaret Sicil No": record.trade_registry_no ?? "",
    "Meslek Grubu": record.profession_group,
    Durumu: record.status,
    Unvan: record.title,
    Yetkililer: record.officials ?? "",
    KÖKEN: record.origin ?? "",
    "OY DURUMU": record.vote_status ?? "",
    "TEMAS 1": contacts[0],
    "TEMAS 2": contacts[1],
    "TEMAS 3": contacts[2],
    "TEMAS 4": contacts[3],
    NOTLAR: record.notes ?? "",
    MAHALLE: record.district ?? "",
    CADDE: record.street ?? "",
    "Tescil Adresi": record.registered_address,
    "Telefon Numaraları": record.phone_numbers,
  };
}

export function exportRecords(records: FurnitureRecord[], prefix = "mobilya-takip") {
  const sheet = XLSX.utils.json_to_sheet(records.map(recordToExcelRow), {
    header: [...EXCEL_HEADERS],
  });
  sheet["!cols"] = [
    7, 12, 15, 28, 10, 55, 28, 15, 15, 20, 20, 20, 20, 48, 22, 25, 55, 45,
  ].map((wch) => ({ wch }));
  sheet["!autofilter"] = { ref: `A1:R${records.length + 1}` };
  for (let row = 1; row <= records.length; row += 1) {
    const rowColor = records[row - 1].row_color;
    if (rowColor) {
      for (let column = 0; column < EXCEL_HEADERS.length; column += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: column });
        if (sheet[address]) {
          sheet[address].s = {
            ...(sheet[address].s ?? {}),
            fill: {
              patternType: "solid",
              fgColor: { rgb: rowColorToRgb[rowColor] },
            },
          };
        }
      }
    }
    for (const column of [13, 17]) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      if (sheet[address]) {
        sheet[address].s = {
          ...(sheet[address].s ?? {}),
          alignment: { wrapText: true, vertical: "top" },
        };
      }
    }
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "MOBİLYA TOP. VE PERAKENDE");
  const stamp = new Intl.DateTimeFormat("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split(".")
    .reverse()
    .join("-");
  XLSX.writeFile(workbook, `${prefix}-${stamp}.xlsx`, {
    compression: true,
    cellStyles: true,
  });
}

function cell(row: Record<string, unknown>, header: string) {
  return normalizeLineEndings(row[header]);
}

export async function parseWorkbook(file: File): Promise<ParsedExcelRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    raw: false,
    cellStyles: true,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Excel dosyasında çalışma sayfası bulunamadı.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const actualHeaders = Object.keys(rows[0] ?? {});
  const missing = EXCEL_HEADERS.filter((header) => !actualHeaders.includes(header));
  if (missing.length) throw new Error(`Eksik sütunlar: ${missing.join(", ")}`);

  return rows.map((row, index) => {
    const displayOrder = Number(cell(row, "Sıra"));
    const memberRegistryNo = cell(row, "Üye Sicil No") ?? "";
    const title = cell(row, "Unvan") ?? "";
    const professionGroup = cell(row, "Meslek Grubu") ?? "";
    const status = cell(row, "Durumu") ?? "";
    const errors: string[] = [];
    if (!Number.isInteger(displayOrder) || displayOrder < 1) errors.push("Sıra geçersiz.");
    if (!memberRegistryNo) errors.push("Üye Sicil No zorunlu.");
    if (!title) errors.push("Unvan zorunlu.");
    if (!professionGroup) errors.push("Meslek Grubu zorunlu.");
    if (!status) errors.push("Durumu zorunlu.");

    const contactNames = ["TEMAS 1", "TEMAS 2", "TEMAS 3", "TEMAS 4"]
      .map((header) => cell(row, header))
      .filter((value): value is string => Boolean(value));
    if (new Set(contactNames.map(normalizeText)).size !== contactNames.length) {
      errors.push("Aynı temas sorumlusu bir satırda birden fazla kullanılmış.");
    }

    const rowNumber = index + 2;
    return {
      row_number: rowNumber,
      display_order: displayOrder,
      member_registry_no: memberRegistryNo,
      trade_registry_no: cell(row, "Ticaret Sicil No"),
      profession_group: professionGroup,
      status,
      title,
      officials: cell(row, "Yetkililer"),
      origin: cell(row, "KÖKEN"),
      vote_status: cell(row, "OY DURUMU"),
      notes: cell(row, "NOTLAR"),
      district: cell(row, "MAHALLE"),
      street: cell(row, "CADDE"),
      registered_address: cell(row, "Tescil Adresi") ?? "",
      phone_numbers: cell(row, "Telefon Numaraları") ?? "",
      row_color: readRowColor(sheet, rowNumber),
      contact_names: contactNames,
      validation_errors: errors,
    };
  });
}
