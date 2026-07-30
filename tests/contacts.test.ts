import { describe, expect, it } from "vitest";
import { parseContactDisplayName } from "@/lib/contacts";
import { createContactCompaniesPdfDefinition } from "@/lib/pdf/contact-companies";
import type { FurnitureRecord } from "@/types/app";

const record = {
  display_order: 12,
  member_registry_no: "00123",
  title: "ÖRNEK MOBİLYA",
  officials: "AYŞE YILMAZ",
  status: "Faal",
  registered_address: "Örnek Mahallesi No: 1",
  phone_numbers: "0224 000 00 00",
} as FurnitureRecord;

describe("Temas sorumlusu iletişim bilgisi", () => {
  it("parantez içindeki numarayı isimden ayırır", () => {
    const parsed = parseContactDisplayName(
      "NEDİM İNCEBAY (0532 111 22 33)",
    );

    expect(parsed.name).toBe("NEDİM İNCEBAY");
    expect(parsed.communicationLines).toEqual(["0532 111 22 33"]);
  });

  it("numara içermeyen parantezli açıklamayı isimde tutar", () => {
    const parsed = parseContactDisplayName("ALİ YILMAZ (BAŞKAN)");

    expect(parsed.name).toBe("ALİ YILMAZ (BAŞKAN)");
    expect(parsed.communicationLines).toEqual([]);
  });
});

describe("Temas sorumlusu PDF çıktısı", () => {
  it("istenen sütun sırasını ve firma alanlarını kullanır", () => {
    const definition = createContactCompaniesPdfDefinition(
      "NEDİM İNCEBAY",
      [record],
    );
    const table = (definition.content as Array<Record<string, any>>)[3].table;
    const headers = table.body[0].map((cell: { text: string }) => cell.text);

    expect(headers).toEqual([
      "SIRA",
      "SİCİL NO",
      "ÜNVAN",
      "YETKİLİ KİŞİ",
      "DURUM",
      "TESCİL ADRESİ",
      "TELEFON",
    ]);
    expect(table.body[1]).toEqual([
      "12",
      "00123",
      "ÖRNEK MOBİLYA",
      "AYŞE YILMAZ",
      "Faal",
      "Örnek Mahallesi No: 1",
      "0224 000 00 00",
    ]);
  });
});
