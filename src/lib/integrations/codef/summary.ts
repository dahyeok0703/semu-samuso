/**
 * CODEF 거래내역 요약 (pure, testable). ★민감정보 비저장 원칙: 계좌번호·상대방 식별자
 * 등은 다루지 않고, 비식별 집계(건수·기간·입출금 합계)만 산출한다.
 */

/** Raw transaction line as returned by CODEF (subset). */
export type RawTxn = { tranDate?: string; inAmount?: string; outAmount?: string };

export type StatementSummary = {
  count: number;
  periodFrom: string | null;
  periodTo: string | null;
  totalIn: number;
  totalOut: number;
};

export function summarizeStatement(txns: RawTxn[]): StatementSummary {
  let totalIn = 0;
  let totalOut = 0;
  let from: string | null = null;
  let to: string | null = null;

  for (const t of txns) {
    totalIn += Number(t.inAmount ?? 0) || 0;
    totalOut += Number(t.outAmount ?? 0) || 0;
    const d = t.tranDate ?? null;
    if (d) {
      if (from === null || d < from) from = d;
      if (to === null || d > to) to = d;
    }
  }

  return { count: txns.length, periodFrom: from, periodTo: to, totalIn, totalOut };
}
