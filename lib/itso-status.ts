import type { FurnitureRecord } from "@/types/app";

export const ITSO_APPROVED_STATUS = "ONAYLANDI";
export const AT_ITSO_STATUS = "İTSO'DA";

export const ITSO_STATUS_OPTIONS = [AT_ITSO_STATUS, ITSO_APPROVED_STATUS] as const;

export function countRecordsByItsoStatus(
  records: Array<Pick<FurnitureRecord, "itso_status">>,
  status: string,
): number {
  return records.filter((record) => record.itso_status === status).length;
}

export function countItsoApproved(
  records: Array<Pick<FurnitureRecord, "itso_status">>,
): number {
  return countRecordsByItsoStatus(records, ITSO_APPROVED_STATUS);
}
