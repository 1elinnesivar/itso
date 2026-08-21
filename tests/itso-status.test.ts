import { describe, expect, it } from "vitest";
import {
  countItsoApproved,
  ITSO_APPROVED_STATUS,
  ITSO_STATUS_OPTIONS,
} from "@/lib/itso-status";

describe("İTSO durumu", () => {
  it("İTSO'DA ve ONAYLANDI seçeneklerini sunar", () => {
    expect(ITSO_STATUS_OPTIONS).toEqual(["İTSO'DA", "ONAYLANDI"]);
  });

  it("yalnız onaylanan kayıtları sayar", () => {
    const records = [
      { itso_status: "İTSO'DA" },
      { itso_status: ITSO_APPROVED_STATUS },
      { itso_status: null },
      { itso_status: ITSO_APPROVED_STATUS },
    ];

    expect(countItsoApproved(records)).toBe(2);
  });
});
