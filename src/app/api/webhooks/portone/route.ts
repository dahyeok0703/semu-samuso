import { NextResponse } from "next/server";

import { getPaymentProvider } from "@/lib/billing/index";
import { applyVerifiedWebhook } from "@/lib/billing/service";
import { env, features } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PortOne v2 webhook receiver.
 *
 *   1. Read the RAW body (signature is computed over the exact bytes).
 *   2. Verify the Standard Webhooks signature (replay-protected).
 *   3. Idempotently process: the unique `event_key` insert dedupes
 *      re-deliveries; the payment is re-fetched from the provider (we never
 *      trust the webhook body) before mutating subscription state.
 *
 * Always returns 200 for accepted-but-noop cases so the provider stops
 * retrying; returns 401 only when the signature cannot be verified.
 */
export async function POST(request: Request) {
  const provider = getPaymentProvider();
  if (!provider) {
    // Billing not configured — ack so the provider doesn't hammer us.
    return NextResponse.json({ ok: true, note: "billing disabled" });
  }

  const rawBody = await request.text();
  const headerBag: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headerBag[key] = value;
  });

  // Require a verifiable signature in production.
  if (!features.billingWebhook) {
    if (env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "PORTONE_WEBHOOK_SECRET 미설정" },
        { status: 503 },
      );
    }
    // Dev convenience: process unsigned events but say so.
    console.warn("[portone] PORTONE_WEBHOOK_SECRET not set — skipping signature check (dev)");
  }

  const verify = provider.verifyWebhook(headerBag, rawBody);
  if (!verify.ok) {
    return NextResponse.json({ ok: false, error: verify.reason }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY 미설정" },
      { status: 503 },
    );
  }

  try {
    const outcome = await applyVerifiedWebhook(admin, verify);
    return NextResponse.json({ ok: true, ...outcome });
  } catch (error) {
    console.error("[portone] webhook processing failed:", error);
    // 500 → provider will retry; idempotency makes retries safe.
    return NextResponse.json({ ok: false, error: "processing error" }, { status: 500 });
  }
}
