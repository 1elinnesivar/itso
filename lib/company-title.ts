import { normalizeText } from "@/lib/utils";

export const INDUSTRY_TRADE_LIMITED_TITLE = "industry_trade_limited";
export const OTHER_COMPANY_TITLE = "other";

export function isIndustryTradeLimitedTitle(title: string): boolean {
  const normalizedTitle = normalizeText(title);
  return [
    "SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "TİCARET VE SANAYİ LİMİTED ŞİRKETİ",
  ].some((phrase) => normalizedTitle.includes(normalizeText(phrase)));
}

export function companyTitleCategory(title: string): string {
  return isIndustryTradeLimitedTitle(title)
    ? INDUSTRY_TRADE_LIMITED_TITLE
    : OTHER_COMPANY_TITLE;
}
