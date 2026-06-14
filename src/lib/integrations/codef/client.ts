import "server-only";

import {
  summarizeStatement,
  type RawTxn,
  type StatementSummary,
} from "@/lib/integrations/codef/summary";
import type { CodefConfig } from "@/lib/integrations/types";

export { summarizeStatement };
export type { RawTxn, StatementSummary };

/**
 * CODEF(코드에프) REST 어댑터. 은행/카드 거래내역을 거래처 **동의(connectedId)** 기반으로
 * 수집한다. 키가 없으면 호출되지 않는다(상위에서 available 검사).
 *
 * ⚠️ 민감정보 비저장 원칙: 원천 거래내역(계좌번호·승인내역 등)은 영구 저장하지 않고,
 * 분류/요약에 필요한 비식별 메타데이터만 다룬다(요약은 summarizeStatement).
 * connectedId 등록(거래처 동의) 인프라는 별도 계약/구축이 필요하다.
 */

const OAUTH_URL = "https://oauth.codef.io/oauth/token";

export async function codefToken(config: CodefConfig): Promise<string | null> {
  if (!config.clientId || !config.clientSecret) return null;
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  try {
    const res = await fetch(OAUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: "grant_type=client_credentials&scope=read",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token?: string };
    return body.access_token ?? null;
  } catch {
    return null;
  }
}
