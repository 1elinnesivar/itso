import { normalizeText } from "@/lib/utils";

export const LIMITED_COMPANY_TITLE = "limited_company";
export const OTHER_COMPANY_TITLE = "other";

export function isLimitedCompanyTitle(title: string): boolean {
  return normalizeText(title).includes(normalizeText("LİMİTED ŞİRKETİ"));
}

export function companyTitleCategory(title: string): string {
  return isLimitedCompanyTitle(title)
    ? LIMITED_COMPANY_TITLE
    : OTHER_COMPANY_TITLE;
}
