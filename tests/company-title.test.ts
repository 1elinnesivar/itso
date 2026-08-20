import { describe, expect, it } from "vitest";
import {
  companyTitleCategory,
  INDUSTRY_TRADE_LIMITED_TITLE,
  isIndustryTradeLimitedTitle,
  OTHER_COMPANY_TITLE,
} from "@/lib/company-title";

describe("Ünvan türü filtresi", () => {
  it("tam yazılan sanayi ve ticaret limited şirketi ünvanını bulur", () => {
    const title = "ÖRNEK MOBİLYA SANAYİ VE TİCARET LİMİTED ŞİRKETİ";

    expect(isIndustryTradeLimitedTitle(title)).toBe(true);
    expect(companyTitleCategory(title)).toBe(INDUSTRY_TRADE_LIMITED_TITLE);
  });

  it("ticaret ve sanayi sırasıyla yazılan açık ünvanı da bulur", () => {
    const title = "ÖRNEK MOBİLYA TİCARET VE SANAYİ LİMİTED ŞİRKETİ";

    expect(isIndustryTradeLimitedTitle(title)).toBe(true);
    expect(companyTitleCategory(title)).toBe(INDUSTRY_TRADE_LIMITED_TITLE);
  });

  it("kısaltmaları açık ünvan grubuna almaz", () => {
    expect(
      isIndustryTradeLimitedTitle("ÖRNEK MOBİLYA SAN. VE TİC. LTD. ŞTİ."),
    ).toBe(false);
    expect(
      companyTitleCategory("ÖRNEK MOBİLYA SAN TİC LTD ŞTİ"),
    ).toBe(OTHER_COMPANY_TITLE);
  });

  it("ifadeyi içermeyen ünvanları diğer grubuna alır", () => {
    expect(companyTitleCategory("ÖRNEK MOBİLYA A.Ş.")).toBe(
      OTHER_COMPANY_TITLE,
    );
  });
});
