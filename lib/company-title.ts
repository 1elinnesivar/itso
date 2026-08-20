import { normalizeText } from "@/lib/utils";

export const LIMITED_COMPANY_TITLE = "limited_company";
export const JOINT_STOCK_COMPANY_TITLE = "joint_stock_company";
export const SOLE_PROPRIETORSHIP_TITLE = "sole_proprietorship";
export const UNKNOWN_COMPANY_TITLE = "unknown_company";

function normalizeCompanyText(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isLimitedCompanyTitle(title: string): boolean {
  return normalizeText(title).includes(normalizeText("LİMİTED ŞİRKETİ"));
}

export function isJointStockCompanyTitle(title: string): boolean {
  return normalizeText(title).includes(normalizeText("ANONİM ŞİRKETİ"));
}

export function isProbableSoleProprietorship(
  title: string,
  officials: string | null | undefined,
): boolean {
  if (
    !officials ||
    isLimitedCompanyTitle(title) ||
    isJointStockCompanyTitle(title)
  ) {
    return false;
  }

  const normalizedTitle = ` ${normalizeCompanyText(title)} `;
  return officials
    .split(/\r?\n|[,;/]/)
    .map(normalizeCompanyText)
    .filter(
      (official) => official.length >= 5 && official.split(" ").length >= 2,
    )
    .some((official) => normalizedTitle.includes(` ${official} `));
}

export function companyTitleCategory(
  title: string,
  officials?: string | null,
): string {
  if (isLimitedCompanyTitle(title)) return LIMITED_COMPANY_TITLE;
  if (isJointStockCompanyTitle(title)) return JOINT_STOCK_COMPANY_TITLE;
  if (isProbableSoleProprietorship(title, officials)) {
    return SOLE_PROPRIETORSHIP_TITLE;
  }
  return UNKNOWN_COMPANY_TITLE;
}
