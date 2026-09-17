import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";
import {
  CURRENT_ROSTER_HEADERS,
  parseCurrentRosterWorkbook,
} from "@/lib/excel/current-roster";

function workbookFile(rows: Record<string, unknown>[]): File {
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: [...CURRENT_ROSTER_HEADERS],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Güncel Firma Listesi");
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
  return { arrayBuffer: async () => buffer } as File;
}

describe("Güncel firma listesi", () => {
  it("PDF'den dönüştürülen alanları okur", async () => {
    const parsed = await parseCurrentRosterWorkbook(
      workbookFile([
        {
          "Sıra No": "2566",
          "Üye Sicil No": "00123",
          "Ticaret Sicil No": "00456",
          Unvan: "ÖRNEK MOBİLYA LİMİTED ŞİRKETİ",
          "Kayıt Tarihi": "01/02/2026",
          "Vergi Dairesi / Vergi Hesap No": "MERKEZ / 1234567890",
          "Yetki / İmza": "MÜNFERİT",
        },
      ]),
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      member_registry_no: "00123",
      trade_registry_no: "00456",
      registration_date: "01/02/2026",
      authority_signature: "MÜNFERİT",
      validation_errors: [],
    });
  });

  it("tekrarlanan sicil numaralarını uygulamadan önce reddeder", async () => {
    const base = {
      "Sıra No": "1",
      "Üye Sicil No": "123",
      "Ticaret Sicil No": "",
      Unvan: "ÖRNEK FİRMA",
      "Kayıt Tarihi": "",
      "Vergi Dairesi / Vergi Hesap No": "",
      "Yetki / İmza": "",
    };
    const parsed = await parseCurrentRosterWorkbook(
      workbookFile([base, { ...base, "Sıra No": "2" }]),
    );

    expect(parsed.every((row) => row.validation_errors.length > 0)).toBe(true);
  });
});
