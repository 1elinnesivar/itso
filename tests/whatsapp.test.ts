import { describe, expect, it } from "vitest";
import {
  CONTACT_WHATSAPP_MESSAGE,
  normalizeWhatsAppNumber,
} from "@/lib/whatsapp";

describe("WhatsApp iletişimi", () => {
  it("Türkiye cep telefonu biçimlerini uluslararası numaraya dönüştürür", () => {
    expect(normalizeWhatsAppNumber("0532 123 45 67")).toBe("905321234567");
    expect(normalizeWhatsAppNumber("+90 532 123 45 67")).toBe("905321234567");
    expect(normalizeWhatsAppNumber("5321234567")).toBe("905321234567");
  });

  it("kopyalanacak iletişim mesajını eksiksiz tutar", () => {
    expect(CONTACT_WHATSAPP_MESSAGE).toContain(
      "*mümkün olan en kısa sürede*",
    );
    expect(CONTACT_WHATSAPP_MESSAGE).toContain(
      "Ticaret ve Sanayi Odası seçimleriyle ilgili",
    );
    expect(CONTACT_WHATSAPP_MESSAGE).toContain("Alican Yavaş\nMobilyamevime");
  });

  it("geçersiz numarayı reddeder", () => {
    expect(normalizeWhatsAppNumber("123")).toBeNull();
  });
});
