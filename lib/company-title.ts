import { normalizeText } from "@/lib/utils";

export const INDUSTRY_TRADE_LIMITED_TITLE = "industry_trade_limited";
export const OTHER_COMPANY_TITLE = "other";

export function isIndustryTradeLimitedTitle(title: string): boolean {
  const normalized = normalizeText(title)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return /\b(?:sanayi|san)\b\s+(?:ve\s+)?(?:ticaret|tic)\b\s+(?:limited|ltd)\b\s+(?:sirketi|sti)\b/.test(
    normalized,
  );
}

export function companyTitleCategory(title: string): string {
  return isIndustryTradeLimitedTitle(title)
    ? INDUSTRY_TRADE_LIMITED_TITLE
    : OTHER_COMPANY_TITLE;
}
