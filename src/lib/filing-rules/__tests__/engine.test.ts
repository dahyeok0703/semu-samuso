import { describe, expect, it } from "vitest";

import { adjustToBusinessDay } from "@/lib/filing-rules/business-days";
import { generateFilingTasks } from "@/lib/filing-rules/engine";
import type { ClientForRules, PlannedTask } from "@/lib/filing-rules/types";

const YEAR = 2025;

function makeClient(overrides: Partial<ClientForRules> = {}): ClientForRules {
  return {
    taxType: "general",
    closingMonth: 12,
    isSemiannualWithholding: false,
    isDiligentFiling: false,
    ...overrides,
  };
}

// Assert against statutory dates: skip business-day adjustment for determinism.
function plan(client: ClientForRules, year = YEAR): PlannedTask[] {
  return generateFilingTasks(client, year, { adjustBusinessDays: false });
}

function byType(tasks: PlannedTask[], filingType: string): PlannedTask[] {
  return tasks.filter((t) => t.filingType === filingType);
}

describe("generateFilingTasks — 개인 일반과세 (general, 매월 원천)", () => {
  const tasks = plan(makeClient());

  it("부가세는 확정 2회만 (예정 없음)", () => {
    expect(byType(tasks, "vat_1_final")[0]?.baseDueDate).toBe("2025-07-25");
    expect(byType(tasks, "vat_2_final")[0]?.baseDueDate).toBe("2026-01-25");
    expect(byType(tasks, "vat_1_preliminary")).toHaveLength(0);
    expect(byType(tasks, "vat_2_preliminary")).toHaveLength(0);
  });

  it("종합소득세 5/31", () => {
    expect(byType(tasks, "income")[0]?.baseDueDate).toBe("2026-05-31");
  });

  it("원천세 매월(익월 10일) 12건", () => {
    const wht = byType(tasks, "withholding_monthly");
    expect(wht).toHaveLength(12);
    expect(wht.find((t) => t.periodLabel === "2025년 1월분")?.baseDueDate).toBe("2025-02-10");
    expect(wht.find((t) => t.periodLabel === "2025년 12월분")?.baseDueDate).toBe("2026-01-10");
  });

  it("법인세는 생성되지 않음", () => {
    expect(byType(tasks, "corporate")).toHaveLength(0);
  });

  it("부가세 task 에 매출 세금계산서가 expected_documents 로 세팅", () => {
    expect(byType(tasks, "vat_1_final")[0]?.expectedDocuments).toContain("매출 세금계산서");
  });
});

describe("generateFilingTasks — 법인 12월 결산 (corporate)", () => {
  const tasks = plan(makeClient({ taxType: "corporate", closingMonth: 12 }));

  it("부가세 예정·확정 4회", () => {
    expect(byType(tasks, "vat_1_preliminary")[0]?.baseDueDate).toBe("2025-04-25");
    expect(byType(tasks, "vat_1_final")[0]?.baseDueDate).toBe("2025-07-25");
    expect(byType(tasks, "vat_2_preliminary")[0]?.baseDueDate).toBe("2025-10-25");
    expect(byType(tasks, "vat_2_final")[0]?.baseDueDate).toBe("2026-01-25");
  });

  it("법인세는 결산월+3개월 말일 → 2026-03-31", () => {
    expect(byType(tasks, "corporate")[0]?.baseDueDate).toBe("2026-03-31");
  });

  it("종합소득세는 생성되지 않음", () => {
    expect(byType(tasks, "income")).toHaveLength(0);
  });
});

describe("generateFilingTasks — 법인 3월 결산", () => {
  it("법인세 → 2025-06-30 (3월말 +3개월)", () => {
    const tasks = plan(makeClient({ taxType: "corporate", closingMonth: 3 }));
    expect(byType(tasks, "corporate")[0]?.baseDueDate).toBe("2025-06-30");
  });
});

describe("generateFilingTasks — 간이과세 (simplified)", () => {
  const tasks = plan(makeClient({ taxType: "simplified" }));

  it("부가세(간이) 연 1회 익년 1/25", () => {
    const vat = byType(tasks, "vat_simplified");
    expect(vat).toHaveLength(1);
    expect(vat[0]?.baseDueDate).toBe("2026-01-25");
  });

  it("일반 부가세 확정은 없음", () => {
    expect(byType(tasks, "vat_1_final")).toHaveLength(0);
  });
});

describe("generateFilingTasks — 면세사업자 (exempt)", () => {
  const tasks = plan(makeClient({ taxType: "exempt" }));

  it("사업장현황신고 2/10", () => {
    expect(byType(tasks, "exempt_status")[0]?.baseDueDate).toBe("2026-02-10");
  });

  it("부가세 task 없음, 종소세 있음", () => {
    expect(tasks.filter((t) => t.category === "vat")).toHaveLength(0);
    expect(byType(tasks, "income")).toHaveLength(1);
  });
});

describe("generateFilingTasks — 반기 원천징수 플래그", () => {
  it("원천세는 반기 2건(7/10, 익년 1/10)으로 생성", () => {
    const tasks = plan(makeClient({ isSemiannualWithholding: true }));
    const semi = byType(tasks, "withholding_semiannual");
    expect(semi).toHaveLength(2);
    expect(semi.map((t) => t.baseDueDate).sort()).toEqual(["2025-07-10", "2026-01-10"]);
    expect(byType(tasks, "withholding_monthly")).toHaveLength(0);
  });
});

describe("generateFilingTasks — 성실신고 플래그", () => {
  it("종합소득세 기한이 6/30 으로 연장", () => {
    const tasks = plan(makeClient({ isDiligentFiling: true }));
    expect(byType(tasks, "income")[0]?.baseDueDate).toBe("2026-06-30");
  });
});

describe("generateFilingTasks — 과세유형 미설정", () => {
  it("빈 배열 반환", () => {
    expect(plan(makeClient({ taxType: null }))).toHaveLength(0);
  });
});

describe("adjustToBusinessDay — 주말/공휴일 보정", () => {
  it("토요일 → 다음 월요일", () => {
    expect(adjustToBusinessDay("2025-01-04")).toBe("2025-01-06"); // 토 → 월
  });
  it("일요일 → 다음 월요일", () => {
    expect(adjustToBusinessDay("2025-01-05")).toBe("2025-01-06");
  });
  it("평일은 그대로", () => {
    expect(adjustToBusinessDay("2025-01-07")).toBe("2025-01-07");
  });
  it("공휴일(월) → 다음 영업일(화)", () => {
    expect(adjustToBusinessDay("2025-01-06", new Set(["2025-01-06"]))).toBe("2025-01-07");
  });
  it("금요일 공휴일 + 주말 연속 → 다음 월요일", () => {
    expect(adjustToBusinessDay("2025-01-03", new Set(["2025-01-03"]))).toBe("2025-01-06");
  });
});

describe("generateFilingTasks — 영업일 보정이 dueDate 에 반영", () => {
  it("기한이 공휴일이면 dueDate 가 다음 영업일로 이동(baseDueDate 는 보존)", () => {
    const tasks = generateFilingTasks(makeClient(), YEAR, {
      holidays: new Set(["2025-02-10"]), // 1월분 원천세 기한을 공휴일로 가정
    });
    const jan = tasks.find((t) => t.periodLabel === "2025년 1월분");
    expect(jan?.baseDueDate).toBe("2025-02-10");
    expect(jan?.dueDate).toBe("2025-02-11");
  });
});
