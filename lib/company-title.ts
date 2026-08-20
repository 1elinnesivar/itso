import { normalizeText } from "@/lib/utils";

export const SOLE_PROPRIETORSHIP_TITLE = "sole_proprietorship";
export const COMPANY_TITLE = "company";

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
  if (isProbableSoleProprietorship(title, officials)) {
    return SOLE_PROPRIETORSHIP_TITLE;
  }
  return COMPANY_TITLE;
}
