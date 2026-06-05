import { describe, expect, it } from "vitest";

import {
  DEFAULT_OFFSETS,
  daysUntil,
  isReminderCandidate,
  matchOffset,
} from "@/lib/messaging/rules";

describe("daysUntil", () => {
  it("미래 날짜는 양수, 과거는 음수", () => {
    expect(daysUntil("2025-01-08", "2025-01-01")).toBe(7);
    expect(daysUntil("2025-01-01", "2025-01-01")).toBe(0);
    expect(daysUntil("2024-12-31", "2025-01-01")).toBe(-1);
  });
});

describe("matchOffset", () => {
  it("정확히 일치하는 오프셋만 반환", () => {
    expect(matchOffset(7, DEFAULT_OFFSETS)).toBe(7);
    expect(matchOffset(3, DEFAULT_OFFSETS)).toBe(3);
    expect(matchOffset(1, DEFAULT_OFFSETS)).toBe(1);
    expect(matchOffset(5, DEFAULT_OFFSETS)).toBeNull();
    expect(matchOffset(0, DEFAULT_OFFSETS)).toBeNull();
  });
});

describe("isReminderCandidate", () => {
  it("자료 미완료 + D-N 정확 일치일 때만 후보", () => {
    expect(isReminderCandidate(3, "missing", DEFAULT_OFFSETS)).toBe(true);
    expect(isReminderCandidate(3, "partial", DEFAULT_OFFSETS)).toBe(true);
    // 완료된 자료는 후보 아님
    expect(isReminderCandidate(3, "complete", DEFAULT_OFFSETS)).toBe(false);
    // D-N 비일치일은 후보 아님
    expect(isReminderCandidate(4, "missing", DEFAULT_OFFSETS)).toBe(false);
  });

  it("커스텀 오프셋을 존중", () => {
    expect(isReminderCandidate(5, "missing", [5, 2])).toBe(true);
    expect(isReminderCandidate(3, "missing", [5, 2])).toBe(false);
  });
});
