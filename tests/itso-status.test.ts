import { describe, expect, it } from "vitest";
import {
  AT_ITSO_STATUS,
  countItsoApproved,
  countRecordsByItsoStatus,
  ITSO_APPROVED_STATUS,
  ITSO_STATUS_OPTIONS,
  RIVAL_APPROVED_STATUS,
} from "@/lib/itso-status";

describe("İTSO durumu", () => {
  it("İTSO durum seçeneklerini sunar", () => {
    expect(ITSO_STATUS_OPTIONS).toEqual([
      "İTSO'DA",
      "ONAYLANDI",
      "RAKİP ONAYLATTI",
    ]);
  });

  it("yalnız onaylanan kayıtları sayar", () => {
    const records = [
      { itso_status: "İTSO'DA" },
      { itso_status: ITSO_APPROVED_STATUS },
      { itso_status: RIVAL_APPROVED_STATUS },
      { itso_status: null },
      { itso_status: ITSO_APPROVED_STATUS },
    ];

    expect(countItsoApproved(records)).toBe(2);
    expect(countRecordsByItsoStatus(records, AT_ITSO_STATUS)).toBe(1);
    expect(countRecordsByItsoStatus(records, RIVAL_APPROVED_STATUS)).toBe(1);
  });
});
