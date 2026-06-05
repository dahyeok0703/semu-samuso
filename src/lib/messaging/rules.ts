/**
 * 독촉 규칙 (순수 함수, DB 비의존).
 * filing_task.due_date 기준 D-N 후보를 판정한다. 기본 오프셋은 7/3/1일.
 */

export const DEFAULT_OFFSETS = [7, 3, 1] as const;
export const DEFAULT_CHANNELS = ["email", "inapp"] as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days from `today` until `dueISO` (UTC). Negative = overdue. */
export function daysUntil(dueISO: string, today: string = todayISO()): number {
  const a = Date.parse(`${dueISO}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

/** The exact offset (e.g. 7/3/1) matching `daysLeft`, or null. */
export function matchOffset(daysLeft: number, offsets: readonly number[]): number | null {
  return offsets.includes(daysLeft) ? daysLeft : null;
}

/**
 * Is this filing task a reminder candidate *today*? True when its docs are not
 * complete and the remaining days exactly equal one of the configured offsets.
 */
export function isReminderCandidate(
  daysLeft: number,
  docsStatus: string,
  offsets: readonly number[],
): boolean {
  return docsStatus !== "complete" && matchOffset(daysLeft, offsets) !== null;
}
