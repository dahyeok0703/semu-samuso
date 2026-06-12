import { AlertTriangle } from "lucide-react";

import { siteConfig } from "@/lib/site";

/**
 * 법적 문서 공통 래퍼.
 *
 * ⚠️⚠️ 중요: 이 디렉터리의 모든 법적 문서(이용약관/개인정보처리방침/환불정책/
 * 제3자 제공·위탁)는 **표준 양식 기반의 초안(플레이스홀더)** 입니다. 실제 서비스
 * 시행 전에 반드시 **변호사·노무사·세무사 등 전문가의 검토**를 받아야 하며, 사업
 * 형태·수집 항목·국외 이전·연동 사업자 등에 맞게 수정해야 합니다(개인정보보호법·
 * 전자상거래법 등). 본 코드/문구는 법률 자문이 아닙니다.
 */
export function LegalDoc({
  title,
  updated = siteConfig.legalEffectiveDate,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">시행일: {updated}</p>

      {/* 검토 필요 경고 — 실제 시행 전 제거 금지 전 반드시 전문가 검토 */}
      <div
        role="note"
        className="mt-6 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <AlertTriangle className="size-5 shrink-0" />
        <p>
          <strong>검토 필요 안내(초안):</strong> 본 문서는 표준 양식을 참고한 예시 초안입니다. 실제
          시행 전 반드시 변호사·노무사·세무사 등 전문가의 검토를 거쳐 회사의 실제 사업 형태와
          개인정보 처리 현황에 맞게 수정해야 합니다.
        </p>
      </div>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:bg-muted/50 [&_th]:p-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
