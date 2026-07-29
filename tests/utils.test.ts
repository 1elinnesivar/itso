import { describe, expect, it } from "vitest";
import { normalizeLineEndings, normalizeText } from "@/lib/utils";

describe("Türkçe metin normalizasyonu", () => {
  it("büyük/küçük harf ve aksan farklarını arama için kaldırır", () => {
    expect(normalizeText("  İNEGÖL  Mobilya ")).toBe(normalizeText("inegol mobilya"));
  });

  it("satır sonlarını LF olarak korur", () => {
    expect(normalizeLineEndings("Telefon 1\r\nTelefon 2\rTelefon 3")).toBe(
      "Telefon 1\nTelefon 2\nTelefon 3",
    );
  });
});

