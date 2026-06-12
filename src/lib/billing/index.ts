import "server-only";

import { features } from "@/lib/env";
import { PortOneProvider } from "@/lib/billing/portone";
import type { PaymentProvider } from "@/lib/billing/provider";

/**
 * Resolve the configured payment provider, or null when billing is not
 * configured (no PortOne keys). Callers degrade gracefully: actions return a
 * friendly error and the UI shows "준비중" rather than crashing.
 *
 * To switch to a direct Toss integration, implement PaymentProvider in a new
 * adapter and return it here — nothing else in the app changes.
 */
let cached: PaymentProvider | null | undefined;

export function getPaymentProvider(): PaymentProvider | null {
  if (cached !== undefined) return cached;
  cached = features.billing ? new PortOneProvider() : null;
  return cached;
}

export { features as billingFeatures };
