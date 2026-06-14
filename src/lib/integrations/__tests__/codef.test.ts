import { describe, expect, it } from "vitest";

import { summarizeStatement, type RawTxn } from "@/lib/integrations/codef/summary";

describe("summarizeStatement (CODEF, PII-minimized)", () => {
  it("totals in/out and finds the period range", () => {
    const txns: RawTxn[] = [
      { tranDate: "20260103", inAmount: "10000", outAmount: "0" },
      { tranDate: "20260101", inAmount: "0", outAmount: "5000" },
      { tranDate: "20260115", inAmount: "2000", outAmount: "0" },
    ];
    const s = summarizeStatement(txns);
    expect(s.count).toBe(3);
    expect(s.totalIn).toBe(12000);
    expect(s.totalOut).toBe(5000);
    expect(s.periodFrom).toBe("20260101");
    expect(s.periodTo).toBe("20260115");
  });

  it("handles empty / malformed amounts safely", () => {
    const s = summarizeStatement([{ tranDate: undefined, inAmount: "x" }, {}]);
    expect(s).toEqual({ count: 2, periodFrom: null, periodTo: null, totalIn: 0, totalOut: 0 });
  });

  it("contains no account/counterparty fields (only aggregates)", () => {
    const s = summarizeStatement([{ tranDate: "20260101", inAmount: "1" }]);
    expect(Object.keys(s).sort()).toEqual([
      "count",
      "periodFrom",
      "periodTo",
      "totalIn",
      "totalOut",
    ]);
  });
});
