import { normalizeText } from "@/lib/utils";

export const LIMITED_COMPANY_TITLE = "limited_company";
export const JOINT_STOCK_COMPANY_TITLE = "joint_stock_company";
export const UNKNOWN_COMPANY_TITLE = "unknown_company";

export function isLimitedCompanyTitle(title: string): boolean {
  return normalizeText(title).includes(normalizeText("LİMİTED ŞİRKETİ"));
}

export function isJointStockCompanyTitle(title: string): boolean {
  return normalizeText(title).includes(normalizeText("ANONİM ŞİRKETİ"));
}

export function companyTitleCategory(title: string): string {
  if (isLimitedCompanyTitle(title)) return LIMITED_COMPANY_TITLE;
  if (isJointStockCompanyTitle(title)) return JOINT_STOCK_COMPANY_TITLE;
  return UNKNOWN_COMPANY_TITLE;
}
