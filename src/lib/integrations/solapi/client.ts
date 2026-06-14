import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { SolapiConfig } from "@/lib/integrations/types";

/**
 * Solapi (쏠라피) REST 어댑터 — HMAC-SHA256 인증. config 는 호출자가 워크스페이스/env
 * 에서 해석해 넘긴다(lib/integrations/settings). 키가 없으면 호출하지 않는다.
 */

export type SolapiSendResult = { ok: boolean; error?: string; groupId?: string | null };

export async function solapiSend(
  config: SolapiConfig,
  message: Record<string, unknown>,
): Promise<SolapiSendResult> {
  if (!config.apiKey || !config.apiSecret) return { ok: false, error: "Solapi 키 미설정" };

  const date = new Date().toISOString();
  const salt = randomBytes(32).toString("hex");
  const signature = createHmac("sha256", config.apiSecret)
    .update(date + salt)
    .digest("hex");

  try {
    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${config.apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({ message }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Solapi ${res.status}: ${text.slice(0, 200)}` };
    let groupId: string | null = null;
    try {
      groupId = (JSON.parse(text) as { groupId?: string }).groupId ?? null;
    } catch {
      groupId = null;
    }
    return { ok: true, groupId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Verify a Solapi delivery-report webhook signature (HMAC-SHA256 over the raw
 * body using the configured secret). When no secret is configured, callers
 * decide whether to accept (dev) or reject (prod).
 */
export function verifySolapiSignature(secret: string, rawBody: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
