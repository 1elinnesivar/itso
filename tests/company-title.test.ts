import { describe, expect, it } from "vitest";
import {
  companyTitleCategory,
  INDUSTRY_TRADE_LIMITED_TITLE,
  isIndustryTradeLimitedTitle,
  OTHER_COMPANY_TITLE,
} from "@/lib/company-title";

describe("Ünvan türü filtresi", () => {
  it("tam yazılan sanayi ve ticaret limited şirketi ünvanını bulur", () => {
    expect(
      isIndustryTradeLimitedTitle(
        "ÖRNEK MOBİLYA SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
      ),
    ).toBe(true);
  });

  it("yaygın kısaltmaları aynı gruba alır", () => {
    expect(
      isIndustryTradeLimitedTitle("ÖRNEK MOBİLYA SAN. VE TİC. LTD. ŞTİ."),
    ).toBe(true);
    expect(
      companyTitleCategory("ÖRNEK MOBİLYA SAN TİC LTD ŞTİ"),
    ).toBe(INDUSTRY_TRADE_LIMITED_TITLE);
  });

  it("ifadeyi içermeyen ünvanları diğer grubuna alır", () => {
    expect(companyTitleCategory("ÖRNEK MOBİLYA A.Ş.")).toBe(
      OTHER_COMPANY_TITLE,
    );
  });
});
