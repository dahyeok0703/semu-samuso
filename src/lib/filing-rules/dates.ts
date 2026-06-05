/**
 * Plain-date helpers. Dates are handled as `YYYY-MM-DD` strings in UTC to avoid
 * local-timezone drift (a deadline must not shift because of the runner's TZ).
 */

export type ISODate = string; // "YYYY-MM-DD"

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build an ISO date. `month` is 1-based. */
export function toISO(year: number, month: number, day: number): ISODate {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Last day (28–31) of a 1-based month. */
export function lastDayOfMonth(year: number, month: number): number {
  // Date.UTC month is 0-based, so day 0 of `month` is the last day of `month`.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Day of week (0=Sun … 6=Sat) for an ISO date, in UTC. */
export function dayOfWeek(iso: ISODate): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** Add `n` days to an ISO date. */
export function addDays(iso: ISODate, n: number): ISODate {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Last day of month, where `month` may exceed 12 and rolls into later years.
 * e.g. endOfMonth(2026, 15) → "2027-03-31" (12월 결산 + 3개월).
 */
export function endOfMonth(year: number, month1Based: number): ISODate {
  const zero = month1Based - 1;
  const y = year + Math.floor(zero / 12);
  const m = (((zero % 12) + 12) % 12) + 1;
  return toISO(y, m, lastDayOfMonth(y, m));
}

export function isWeekend(iso: ISODate): boolean {
  const d = dayOfWeek(iso);
  return d === 0 || d === 6;
}
