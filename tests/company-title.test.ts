import { describe, expect, it } from "vitest";
import {
  companyTitleCategory,
  isJointStockCompanyTitle,
  isLimitedCompanyTitle,
  JOINT_STOCK_COMPANY_TITLE,
  LIMITED_COMPANY_TITLE,
  UNKNOWN_COMPANY_TITLE,
} from "@/lib/company-title";

describe("Ünvan türü filtresi", () => {
  it("sanayi ve ticaret limited şirketi ünvanını bulur", () => {
    const title = "ÖRNEK MOBİLYA SANAYİ VE TİCARET LİMİTED ŞİRKETİ";

    expect(isLimitedCompanyTitle(title)).toBe(true);
    expect(companyTitleCategory(title)).toBe(LIMITED_COMPANY_TITLE);
  });

  it("ticaret ve sanayi sırasıyla yazılan ünvanı da bulur", () => {
    const title = "ÖRNEK MOBİLYA TİCARET VE SANAYİ LİMİTED ŞİRKETİ";

    expect(isLimitedCompanyTitle(title)).toBe(true);
    expect(companyTitleCategory(title)).toBe(LIMITED_COMPANY_TITLE);
  });

  it("sanayi veya ticaret ifadesi olmasa da limited şirketi bulur", () => {
    const title = "ÖRNEK MOBİLYA PAZARLAMA LİMİTED ŞİRKETİ";

    expect(isLimitedCompanyTitle(title)).toBe(true);
    expect(companyTitleCategory(title)).toBe(LIMITED_COMPANY_TITLE);
  });

  it("kısaltmaları açık ünvan grubuna almaz", () => {
    expect(
      isLimitedCompanyTitle("ÖRNEK MOBİLYA SAN. VE TİC. LTD. ŞTİ."),
    ).toBe(false);
    expect(
      companyTitleCategory("ÖRNEK MOBİLYA SAN TİC LTD ŞTİ"),
    ).toBe(UNKNOWN_COMPANY_TITLE);
  });

  it("anonim şirketleri ayrı gruba alır", () => {
    const title = "ÖRNEK MOBİLYA SANAYİ VE TİCARET ANONİM ŞİRKETİ";

    expect(isJointStockCompanyTitle(title)).toBe(true);
    expect(companyTitleCategory(title)).toBe(JOINT_STOCK_COMPANY_TITLE);
  });

  it("iki açık şirket ibaresini içermeyen ünvanları bilinmeyen gruba alır", () => {
    expect(companyTitleCategory("ÖRNEK MOBİLYA")).toBe(
      UNKNOWN_COMPANY_TITLE,
    );
  });
});
