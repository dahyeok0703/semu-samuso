import type { ClientStatus, TaxType } from "@/types/database.types";
import type { BadgeProps } from "@/components/ui/badge";

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  general: "일반과세",
  simplified: "간이과세",
  exempt: "면세",
  corporate: "법인",
};

export const TAX_TYPE_OPTIONS = (Object.keys(TAX_TYPE_LABELS) as TaxType[]).map((value) => ({
  value,
  label: TAX_TYPE_LABELS[value],
}));

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "정상",
  paused: "중단",
  ended: "해지",
};

export const CLIENT_STATUS_OPTIONS = (Object.keys(CLIENT_STATUS_LABELS) as ClientStatus[]).map(
  (value) => ({ value, label: CLIENT_STATUS_LABELS[value] }),
);

export const CLIENT_STATUS_BADGE: Record<ClientStatus, BadgeProps["variant"]> = {
  active: "success",
  paused: "warning",
  ended: "muted",
};

export const CLOSING_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}월`,
}));

export const CLIENT_SORTABLE_COLUMNS = ["biz_name", "biz_reg_no", "created_at", "status"] as const;
export type ClientSortColumn = (typeof CLIENT_SORTABLE_COLUMNS)[number];

export const CLIENT_PAGE_SIZE = 20;
