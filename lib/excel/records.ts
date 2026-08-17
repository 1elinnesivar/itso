import * as XLSX from "xlsx-js-style";
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
  "HEDİYE",
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
    "TEMAS 1": contacts[0] ?? "",
    "TEMAS 2": contacts[1] ?? "",
    "TEMAS 3": contacts[2] ?? "",
    "TEMAS 4": contacts[3] ?? "",
    ...Object.fromEntries(
      contacts.slice(4).map((contact, index) => [`TEMAS ${index + 5}`, contact]),
    ),
    NOTLAR: record.notes ?? "",
    MAHALLE: record.district ?? "",
    CADDE: record.street ?? "",
    "Tescil Adresi": record.registered_address,
    "Telefon Numaraları": record.phone_numbers,
    HEDİYE: record.gift ? "EVET" : "",
  };
}

const thinBorder = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
} as const;

const sourceColumnWidths = [
  6.5, 7.79, 8.07, 13.07, 8.79, 33.07, 32.79, 11.5, 33.07,
] as const;

const trailingColumnWidths = [51.64, 19.64, 19.93, 36.64, 33.5, 10] as const;

function estimatedLineCount(value: unknown, width: number) {
  const charactersPerLine = Math.max(4, Math.floor(width * 0.85));
  return String(value ?? "")
    .split("\n")
    .reduce(
      (total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)),
      0,
    );
}

export function createRecordsWorkbook(records: FurnitureRecord[]) {
  const contactCount = Math.max(
    4,
    ...records.map((record) => record.record_contacts.length),
  );
  const headers = [
    ...EXCEL_HEADERS.slice(0, 9),
    ...Array.from({ length: contactCount }, (_, index) => `TEMAS ${index + 1}`),
    ...EXCEL_HEADERS.slice(13),
  ];
  const rows = records.map(recordToExcelRow);
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  sheet["!cols"] = [
    ...sourceColumnWidths,
    ...Array.from({ length: contactCount }, () => 14.93),
    ...trailingColumnWidths,
  ].map((wch) => ({ wch }));
  sheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: records.length, c: headers.length - 1 },
    }),
  };
  sheet["!rows"] = [{ hpt: 25.5 }];

  for (let column = 0; column < headers.length; column += 1) {
    const address = XLSX.utils.encode_cell({ r: 0, c: column });
    sheet[address].s = {
      font: { name: "Arial", sz: 10, bold: true, color: { rgb: "000000" } },
      fill: { patternType: "solid", fgColor: { rgb: "C0C0C0" } },
      alignment: {
        horizontal: "center",
        vertical: "center",
        wrapText: true,
      },
      border: thinBorder,
    };
  }

  for (let row = 1; row <= records.length; row += 1) {
    const record = records[row - 1];
    const rowValues = rows[row - 1] as Record<string, unknown>;
    let maxLines = 1;

    for (let column = 0; column < headers.length; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      if (!sheet[address]) sheet[address] = { t: "s", v: "" };

      const width =
        column < sourceColumnWidths.length
          ? sourceColumnWidths[column]
          : column < sourceColumnWidths.length + contactCount
            ? 14.93
            : trailingColumnWidths[
                column - sourceColumnWidths.length - contactCount
              ];
      maxLines = Math.max(
        maxLines,
        estimatedLineCount(rowValues[headers[column]], width),
      );

      sheet[address].s = {
        font: { name: "Arial", sz: 10, color: { rgb: "000000" } },
        alignment: {
          horizontal: column <= 4 ? "center" : "left",
          vertical: "center",
          wrapText: true,
        },
        border: thinBorder,
        ...(record.row_color
          ? {
              fill: {
                patternType: "solid",
                fgColor: { rgb: rowColorToRgb[record.row_color] },
              },
            }
          : {}),
      };
    }

    sheet["!rows"][row] = {
      hpt: Math.min(127.5, Math.max(25.5, maxLines * 17 + 8)),
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    "MOBİLYA TOP. VE PERAKENDE",
  );
  return workbook;
}

export function exportRecords(records: FurnitureRecord[], prefix = "mobilya-takip") {
  const workbook = createRecordsWorkbook(records);
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
  const missing = EXCEL_HEADERS.filter(
    (header) => header !== "HEDİYE" && !actualHeaders.includes(header),
  );
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

    const contactHeaders = actualHeaders
      .filter((header) => /^TEMAS \d+$/.test(header))
      .sort((left, right) => Number(left.slice(6)) - Number(right.slice(6)));
    const contactNames = contactHeaders
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
      gift: ["EVET", "VAR", "TRUE", "1", "X", "✓"].includes(
        (cell(row, "HEDİYE") ?? "").toLocaleUpperCase("tr-TR"),
      ),
      row_color: readRowColor(sheet, rowNumber),
      contact_names: contactNames,
      validation_errors: errors,
    };
  });
}
