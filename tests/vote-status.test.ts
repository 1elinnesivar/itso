import { describe, expect, it } from "vitest";
import {
  AUTHORIZATION_DOCUMENT_RECEIVED,
  countRecordsByVoteStatus,
  VOTE_STATUS_OPTIONS,
} from "@/lib/vote-status";

describe("Oy durumu seçenekleri", () => {
  it("kayıt formunda kullanılacak sabit seçenekleri korur", () => {
    expect(VOTE_STATUS_OPTIONS).toEqual([
      "OY GARANTİ",
      "RAKİP",
      "YETKİ BELGESİ ALINDI",
    ]);
  });

  it("yetki belgesi alınan kayıtların sayısını hesaplar", () => {
    const records = [
      { vote_status: "YETKİ BELGESİ ALINDI" },
      { vote_status: "RAKİP" },
      { vote_status: "YETKİ BELGESİ ALINDI" },
      { vote_status: null },
    ];

    expect(
      countRecordsByVoteStatus(records, AUTHORIZATION_DOCUMENT_RECEIVED),
    ).toBe(2);
  });
});
