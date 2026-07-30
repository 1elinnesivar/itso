import { describe, expect, it } from "vitest";
import {
  CONTACT_WHATSAPP_MESSAGE,
  createWhatsAppUrl,
  normalizeWhatsAppNumber,
} from "@/lib/whatsapp";

describe("WhatsApp iletişimi", () => {
  it("Türkiye cep telefonu biçimlerini uluslararası numaraya dönüştürür", () => {
    expect(normalizeWhatsAppNumber("0532 123 45 67")).toBe("905321234567");
    expect(normalizeWhatsAppNumber("+90 532 123 45 67")).toBe("905321234567");
    expect(normalizeWhatsAppNumber("5321234567")).toBe("905321234567");
  });

  it("hazırlanan mesajı WhatsApp bağlantısına eksiksiz ekler", () => {
    const url = createWhatsAppUrl("0532 123 45 67");

    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.hostname).toBe("wa.me");
    expect(parsed.pathname).toBe("/905321234567");
    expect(parsed.searchParams.get("text")).toBe(CONTACT_WHATSAPP_MESSAGE);
    expect(CONTACT_WHATSAPP_MESSAGE).toContain("Alican Yavaş\nMobilyamevime");
  });

  it("geçersiz numarayı reddeder", () => {
    expect(normalizeWhatsAppNumber("123")).toBeNull();
    expect(createWhatsAppUrl("123")).toBeNull();
  });
});
