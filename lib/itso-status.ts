import type { FurnitureRecord } from "@/types/app";

export const ITSO_APPROVED_STATUS = "ONAYLANDI";

export const ITSO_STATUS_OPTIONS = ["İTSO'DA", ITSO_APPROVED_STATUS] as const;

export function countItsoApproved(
  records: Array<Pick<FurnitureRecord, "itso_status">>,
): number {
  return records.filter(
    (record) => record.itso_status === ITSO_APPROVED_STATUS,
  ).length;
}
