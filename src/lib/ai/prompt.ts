import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { DOC_TYPE_LABELS, DOC_TYPES } from "@/lib/ai/doc-types";
import type { RagExample } from "@/lib/ai/rag";

/**
 * 분류 system 프롬프트 — **안정적(stable) 텍스트만** 담는다. 요청마다 바뀌는
 * RAG 예시/문서는 user 메시지로 보낸다(프롬프트 캐시 prefix 보존, prompt-caching.md).
 *
 * ★워크스페이스 격리(이중): (1) RAG 예시는 호출자가 RLS 로 현재 워크스페이스
 *   이력만 조회해 주입하고, (2) 아래 지침으로 "주어진 예시 외 다른 출처의 지식으로
 *   추론하지 말 것"을 강제한다.
 * ★PII 최소 전송: 문서 원문은 분류에 필요한 만큼만 전달하고, 과거 예시는 발행처명/
 *   금액대/키워드 등 검색 feature 만 담는다(전체 내역·계좌번호 등 비전송).
 */
const DOC_TYPE_LIST = DOC_TYPES.map((c) => `- ${c}: ${DOC_TYPE_LABELS[c]}`).join("\n");

export const SYSTEM_PROMPT = `당신은 한국 세무사무소의 수취 서류를 분류하는 보조 시스템입니다.

[역할]
주어진 서류 1건을 보고 종류를 판별하고, 어느 거래처/신고기간에 귀속되는지 추정합니다.

[서류 종류(doc_type)]
${DOC_TYPE_LIST}

[판단 지침]
- 세금계산서/계산서: 공급가액·세액·공급자/공급받는자 사업자번호가 보이면 tax_invoice.
- 카드매출전표·승인내역: card_slip. 간이영수증·현금영수증: receipt.
- 예금/통장 거래내역: bankbook. 급여대장·임금명세: payroll. 그 외: other.
- 사업자등록번호(10자리)와 상호가 보이면 추출해 matched_client 에 담고, 제시된
  "현재 거래처"와 같으면 matches_current=true.
- 신고기간은 문서의 거래일자/귀속월로 추정합니다(예: "2025-1기", "2025-03"). 불확실하면 null.
- 확신이 없으면 confidence 를 낮게 주세요. 추측으로 높은 confidence 를 주지 마세요.

[참고자료 사용 규칙 — 중요]
- user 메시지의 "이 거래처의 과거 처리 예시"는 **현재 워크스페이스의 확정 이력**입니다.
  이 예시와 현재 문서의 근거에만 기반해 판단하세요.
- 예시에 없는 다른 사무소/거래처의 정보를 가정하거나 만들어내지 마세요.

[출력]
- 반드시 지정된 JSON 스키마로만 답하세요. 그 외 텍스트·설명·코드블록 금지.`;

/** Render the per-workspace RAG examples as a compact text block (features only). */
function renderRagExamples(examples: RagExample[]): string {
  if (examples.length === 0) {
    return "이 거래처의 과거 처리 예시: (아직 확정 이력 없음 — 문서 근거만으로 판단)";
  }
  const lines = examples.map((e, i) => {
    const parts = [`종류=${DOC_TYPE_LABELS[e.doc_type] ?? e.doc_type}`];
    if (e.vendor) parts.push(`발행처=${e.vendor}`);
    if (e.amount_band) parts.push(`금액대=${e.amount_band}`);
    if (e.account_hint) parts.push(`계정=${e.account_hint}`);
    if (e.keywords.length) parts.push(`키워드=${e.keywords.join(",")}`);
    return `${i + 1}. ${parts.join(" · ")}`;
  });
  return ["이 거래처의 과거 처리 예시(확정 이력):", ...lines].join("\n");
}

export type ClientContext = {
  bizName: string;
  bizRegNo: string | null;
};

/**
 * Build the volatile user content: client context + RAG examples + the document
 * content blocks (text or image/pdf). Document blocks come last.
 */
export function buildUserContent(
  client: ClientContext,
  examples: RagExample[],
  documentBlocks: Anthropic.ContentBlockParam[],
): Anthropic.ContentBlockParam[] {
  const context = [
    `현재 거래처: 상호=${client.bizName}${client.bizRegNo ? ` · 사업자번호=${client.bizRegNo}` : ""}`,
    "",
    renderRagExamples(examples),
    "",
    "아래 서류를 분류하세요.",
  ].join("\n");

  return [{ type: "text", text: context }, ...documentBlocks];
}
