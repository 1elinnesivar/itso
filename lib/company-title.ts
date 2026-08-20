import { normalizeText } from "@/lib/utils";

export const INDUSTRY_TRADE_LIMITED_TITLE = "industry_trade_limited";
export const OTHER_COMPANY_TITLE = "other";

export function isIndustryTradeLimitedTitle(title: string): boolean {
  return normalizeText(title).includes(
    normalizeText("SANAYİ VE TİCARET LİMİTED ŞİRKETİ"),
  );
}

export function companyTitleCategory(title: string): string {
  return isIndustryTradeLimitedTitle(title)
    ? INDUSTRY_TRADE_LIMITED_TITLE
    : OTHER_COMPANY_TITLE;
}
