import * as XLSX from "xlsx-js-style";
import { normalizeLineEndings } from "@/lib/utils";

export const CURRENT_ROSTER_HEADERS = [
  "Sıra No",
  "Üye Sicil No",
  "Ticaret Sicil No",
  "Unvan",
  "Kayıt Tarihi",
  "Vergi Dairesi / Vergi Hesap No",
  "Yetki / İmza",
] as const;

export interface CurrentRosterRow {
  row_number: number;
  member_registry_no: string;
  trade_registry_no: string | null;
  title: string;
  registration_date: string | null;
  tax_office_account: string | null;
  authority_signature: string | null;
  validation_errors: string[];
}

function cell(row: Record<string, unknown>, header: string): string | null {
  return normalizeLineEndings(row[header]);
}

export async function parseCurrentRosterWorkbook(
  file: File,
): Promise<CurrentRosterRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    raw: false,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Dosyada çalışma sayfası bulunamadı.");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const actualHeaders = Object.keys(rows[0] ?? {});
  const missingHeaders = CURRENT_ROSTER_HEADERS.filter(
    (header) => !actualHeaders.includes(header),
  );
  if (missingHeaders.length) {
    throw new Error(`Eksik sütunlar: ${missingHeaders.join(", ")}`);
  }

  const parsed = rows.map((row, index) => {
    const memberRegistryNo = cell(row, "Üye Sicil No") ?? "";
    const title = cell(row, "Unvan") ?? "";
    const errors: string[] = [];
    if (!memberRegistryNo) errors.push("Üye Sicil No zorunlu.");
    if (!title) errors.push("Unvan zorunlu.");
    return {
      row_number: index + 2,
      member_registry_no: memberRegistryNo,
      trade_registry_no: cell(row, "Ticaret Sicil No"),
      title,
      registration_date: cell(row, "Kayıt Tarihi"),
      tax_office_account: cell(row, "Vergi Dairesi / Vergi Hesap No"),
      authority_signature: cell(row, "Yetki / İmza"),
      validation_errors: errors,
    } satisfies CurrentRosterRow;
  });

  const memberCounts = new Map<string, number>();
  const tradeCounts = new Map<string, number>();
  parsed.forEach((row) => {
    memberCounts.set(
      row.member_registry_no,
      (memberCounts.get(row.member_registry_no) ?? 0) + 1,
    );
    if (row.trade_registry_no) {
      tradeCounts.set(
        row.trade_registry_no,
        (tradeCounts.get(row.trade_registry_no) ?? 0) + 1,
      );
    }
  });
  return parsed.map((row) => ({
    ...row,
    validation_errors: [
      ...row.validation_errors,
      ...((memberCounts.get(row.member_registry_no) ?? 0) > 1
        ? ["Üye Sicil No dosyada tekrarlanıyor."]
        : []),
      ...(row.trade_registry_no &&
      (tradeCounts.get(row.trade_registry_no) ?? 0) > 1
        ? ["Ticaret Sicil No dosyada tekrarlanıyor."]
        : []),
    ],
  }));
}
