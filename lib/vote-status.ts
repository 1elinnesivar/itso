import type { FurnitureRecord } from "@/types/app";

export const AUTHORIZATION_DOCUMENT_RECEIVED = "YETKİ BELGESİ ALINDI";

export const VOTE_STATUS_OPTIONS = [
  "OY GARANTİ",
  "RAKİP",
  AUTHORIZATION_DOCUMENT_RECEIVED,
] as const;

export function countRecordsByVoteStatus(
  records: Array<Pick<FurnitureRecord, "vote_status">>,
  voteStatus: string,
): number {
  return records.filter((record) => record.vote_status === voteStatus).length;
}
