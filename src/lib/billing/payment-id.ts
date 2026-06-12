/**
 * Payment id <-> workspace mapping (pure, testable). We embed the workspace id
 * in the payment id so the webhook can resolve the tenant without trusting the
 * payload body:  pay_<uuid>_<epochMs>
 */

const PAYMENT_RE = /^pay_([0-9a-fA-F-]{36})_\d+$/;

export function newPaymentId(workspaceId: string, now: number = Date.now()): string {
  return `pay_${workspaceId}_${now}`;
}

export function workspaceIdFromPaymentId(paymentId: string | null): string | null {
  if (!paymentId) return null;
  const m = PAYMENT_RE.exec(paymentId);
  return m ? m[1]! : null;
}
