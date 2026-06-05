/**
 * 영업일 보정. 마감일이 주말/공휴일이면 다음 영업일로 미룬다.
 *
 * - 주말 보정: 구현됨 (토/일 → 월).
 * - 공휴일 보정: 주입된 공휴일 집합 기준 (holidays.ts). 공휴일 데이터가 없는
 *   연도는 주말 보정만 적용된다.
 *
 * ⚠️ 신고기한 보정 규칙(특히 공휴일/토요일 처리)은 세목·연도별로 다를 수 있어
 *    **세무사 검수 및 개정세법 반영이 필요**합니다.
 */

import { addDays, isWeekend, type ISODate } from "@/lib/filing-rules/dates";

export type HolidayPredicate = (iso: ISODate) => boolean;

export function holidaysToPredicate(holidays: Set<string> | HolidayPredicate): HolidayPredicate {
  return typeof holidays === "function" ? holidays : (iso) => holidays.has(iso);
}

/**
 * Move `iso` forward to the next business day when it falls on a weekend or a
 * holiday. Bounded loop (never iterates more than ~10 days).
 */
export function adjustToBusinessDay(
  iso: ISODate,
  holidays: Set<string> | HolidayPredicate = new Set<string>(),
): ISODate {
  const isHoliday = holidaysToPredicate(holidays);
  let current = iso;
  // Guard against pathological inputs; consecutive non-business days never
  // exceed a handful in the Korean calendar.
  for (let i = 0; i < 14; i += 1) {
    if (!isWeekend(current) && !isHoliday(current)) return current;
    current = addDays(current, 1);
  }
  return current;
}
