import type { BadgeProps } from "@/components/ui/badge";
import type { DocsStatus, FilingStatus } from "@/types/database.types";

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  pending: "대기",
  docs_received: "자료 수취",
  filed: "신고 완료",
  done: "완료",
};

export const FILING_STATUS_BADGE: Record<FilingStatus, BadgeProps["variant"]> = {
  pending: "muted",
  docs_received: "warning",
  filed: "secondary",
  done: "success",
};

export const FILING_STATUS_OPTIONS = (Object.keys(FILING_STATUS_LABELS) as FilingStatus[]).map(
  (value) => ({ value, label: FILING_STATUS_LABELS[value] }),
);

export const DOCS_STATUS_LABELS: Record<DocsStatus, string> = {
  missing: "미수취",
  partial: "일부",
  complete: "완료",
};

export const DOCS_STATUS_BADGE: Record<DocsStatus, BadgeProps["variant"]> = {
  missing: "muted",
  partial: "warning",
  complete: "success",
};

export const DOCS_STATUS_OPTIONS = (Object.keys(DOCS_STATUS_LABELS) as DocsStatus[]).map(
  (value) => ({ value, label: DOCS_STATUS_LABELS[value] }),
);

/** Tasks due within this many days (and not done) are highlighted as 임박. */
export const IMMINENT_DAYS = 7;

/** Derive docs_status from received/total expected documents. */
export function deriveDocsStatus(received: number, total: number): DocsStatus {
  if (total === 0 || received === 0) return "missing";
  if (received >= total) return "complete";
  return "partial";
}
