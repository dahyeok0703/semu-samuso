/**
 * 사업자등록번호 (Korean business registration number) utilities.
 *
 * Format: 10 digits, conventionally shown as `XXX-XX-XXXXX`.
 * The 10th digit is a checksum over the first 9.
 */

const WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5] as const;

/** Strip everything but digits. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Format a 10-digit string as `XXX-XX-XXXXX`. Returns input unchanged if not 10 digits. */
export function formatBizRegNo(value: string): string {
  const d = digitsOnly(value);
  if (d.length !== 10) return value;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** True when the value is exactly 10 digits (ignoring hyphens). */
export function hasBizRegNoShape(value: string): boolean {
  return digitsOnly(value).length === 10;
}

/**
 * Validate the checksum of a 사업자등록번호.
 * Algorithm (NTS): weighted sum of the first 9 digits + floor(d9 * 5 / 10),
 * the check digit is (10 - sum % 10) % 10.
 */
export function isValidBizRegNo(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length !== 10) return false;
  // Reject all-zeros / obviously invalid.
  if (/^0+$/.test(d)) return false;

  let sum = 0;
  const nums = d.split("").map((c) => Number(c));
  for (let i = 0; i < 9; i += 1) {
    sum += (nums[i] ?? 0) * (WEIGHTS[i] ?? 0);
  }
  sum += Math.floor(((nums[8] ?? 0) * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return check === (nums[9] ?? -1);
}
