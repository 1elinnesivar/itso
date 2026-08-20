import { describe, expect, it } from "vitest";
import {
  COMPANY_TITLE,
  companyTitleCategory,
  isJointStockCompanyTitle,
  isLimitedCompanyTitle,
  isProbableSoleProprietorship,
  SOLE_PROPRIETORSHIP_TITLE,
} from "@/lib/company-title";

describe("Ünvan türü filtresi", () => {
  it("sanayi ve ticaret limited şirketi ünvanını bulur", () => {
    const title = "ÖRNEK MOBİLYA SANAYİ VE TİCARET LİMİTED ŞİRKETİ";

    expect(isLimitedCompanyTitle(title)).toBe(true);
    expect(companyTitleCategory(title)).toBe(COMPANY_TITLE);
  });

  it("ticaret ve sanayi sırasıyla yazılan ünvanı da bulur", () => {
    const title = "ÖRNEK MOBİLYA TİCARET VE SANAYİ LİMİTED ŞİRKETİ";

    expect(isLimitedCompanyTitle(title)).toBe(true);
    expect(companyTitleCategory(title)).toBe(COMPANY_TITLE);
  });

  it("sanayi veya ticaret ifadesi olmasa da limited şirketi bulur", () => {
    const title = "ÖRNEK MOBİLYA PAZARLAMA LİMİTED ŞİRKETİ";

    expect(isLimitedCompanyTitle(title)).toBe(true);
    expect(companyTitleCategory(title)).toBe(COMPANY_TITLE);
  });

  it("kısaltmaları açık ünvan grubuna almaz", () => {
    expect(
      isLimitedCompanyTitle("ÖRNEK MOBİLYA SAN. VE TİC. LTD. ŞTİ."),
    ).toBe(false);
    expect(
      companyTitleCategory("ÖRNEK MOBİLYA SAN TİC LTD ŞTİ"),
    ).toBe(COMPANY_TITLE);
  });

  it("anonim şirketleri ayrı gruba alır", () => {
    const title = "ÖRNEK MOBİLYA SANAYİ VE TİCARET ANONİM ŞİRKETİ";

    expect(isJointStockCompanyTitle(title)).toBe(true);
    expect(companyTitleCategory(title)).toBe(COMPANY_TITLE);
  });

  it("şahıs kuralına uymayan diğer ünvanları şirketler grubuna alır", () => {
    expect(companyTitleCategory("ÖRNEK MOBİLYA")).toBe(COMPANY_TITLE);
  });

  it("yetkili adı ünvanda geçen kaydı tahmini şahıs firması olarak ayırır", () => {
    const title = "AHMET YILMAZ ÖRNEK MOBİLYA";

    expect(isProbableSoleProprietorship(title, "AHMET YILMAZ")).toBe(true);
    expect(companyTitleCategory(title, "AHMET YILMAZ")).toBe(
      SOLE_PROPRIETORSHIP_TITLE,
    );
  });

  it("yetkili eşleşse bile limited ve anonim şirketleri şahıs saymaz", () => {
    expect(
      isProbableSoleProprietorship(
        "AHMET YILMAZ MOBİLYA LİMİTED ŞİRKETİ",
        "AHMET YILMAZ",
      ),
    ).toBe(false);
    expect(
      companyTitleCategory(
        "AHMET YILMAZ MOBİLYA ANONİM ŞİRKETİ",
        "AHMET YILMAZ",
      ),
    ).toBe(COMPANY_TITLE);
  });

  it("tek kelimelik yetkili değerini şahıs eşleşmesi kabul etmez", () => {
    expect(isProbableSoleProprietorship("AHMET MOBİLYA", "AHMET")).toBe(
      false,
    );
  });
});
