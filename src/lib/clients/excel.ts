import * as XLSX from "xlsx";

import { TAX_TYPE_LABELS, CLIENT_STATUS_LABELS } from "@/lib/clients/constants";
import type { ClientFormValues } from "@/lib/clients/schemas";
import type { ClientStatus, TaxType } from "@/types/database.types";

/** Ordered template columns (Korean headers shown to the user). `*` = required. */
export const TEMPLATE_COLUMNS = [
  { header: "상호*", field: "biz_name" },
  { header: "사업자등록번호", field: "biz_reg_no" },
  { header: "대표자", field: "ceo_name" },
  { header: "업종", field: "industry" },
  { header: "과세유형", field: "tax_type" },
  { header: "결산월", field: "closing_month" },
  { header: "반기원천(Y/N)", field: "is_semiannual_withholding" },
  { header: "성실신고(Y/N)", field: "is_diligent_filing" },
  { header: "연락처", field: "contact_phone" },
  { header: "카카오", field: "contact_kakao" },
  { header: "이메일", field: "contact_email" },
  { header: "상태", field: "status" },
  { header: "메모", field: "memo" },
] as const;

type Field = (typeof TEMPLATE_COLUMNS)[number]["field"];

const HEADER_TO_FIELD = new Map<string, Field>(
  TEMPLATE_COLUMNS.map((c) => [normalizeHeader(c.header), c.field]),
);

function normalizeHeader(h: string): string {
  return h.replace(/\*/g, "").replace(/\s+/g, "").trim();
}

const EXAMPLE_ROW: Record<Field, string> = {
  biz_name: "가나다상사",
  biz_reg_no: "123-45-67891",
  ceo_name: "홍길동",
  industry: "도소매",
  tax_type: "일반과세",
  closing_month: "12",
  is_semiannual_withholding: "N",
  is_diligent_filing: "N",
  contact_phone: "02-123-4567",
  contact_kakao: "@gananda",
  contact_email: "owner@example.com",
  status: "정상",
  memo: "예시 행 — 삭제 후 사용하세요",
};

/** Generate and download the import template .xlsx. */
export function downloadClientTemplate(): void {
  const headers = TEMPLATE_COLUMNS.map((c) => c.header);
  const example = TEMPLATE_COLUMNS.map((c) => EXAMPLE_ROW[c.field]);
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = TEMPLATE_COLUMNS.map((c) => ({ wch: Math.max(12, c.header.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "거래처");
  XLSX.writeFile(wb, "거래처_일괄등록_템플릿.xlsx");
}

export type RawImportRow = {
  rowNumber: number; // 1-based data row number (excludes header)
  values: ClientFormValues;
};

function toTaxType(input: string): TaxType | null {
  const v = input.trim();
  if (v === "") return null;
  const byLabel = (Object.keys(TAX_TYPE_LABELS) as TaxType[]).find(
    (k) => TAX_TYPE_LABELS[k] === v || k === v,
  );
  if (byLabel) return byLabel;
  if (v.includes("일반")) return "general";
  if (v.includes("간이")) return "simplified";
  if (v.includes("면세")) return "exempt";
  if (v.includes("법인")) return "corporate";
  return null;
}

function toStatus(input: string): ClientStatus {
  const v = input.trim();
  const byLabel = (Object.keys(CLIENT_STATUS_LABELS) as ClientStatus[]).find(
    (k) => CLIENT_STATUS_LABELS[k] === v || k === v,
  );
  if (byLabel) return byLabel;
  if (v.includes("해지")) return "ended";
  if (v.includes("중단")) return "paused";
  return "active";
}

function toBool(input: string): boolean {
  const v = input.trim().toLowerCase();
  return ["y", "yes", "예", "true", "1", "o", "ㅇ"].includes(v);
}

function toClosingMonth(input: string): number {
  const n = Number(input.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : 12;
}

function cell(raw: Partial<Record<Field, unknown>>, field: Field): string {
  const value = raw[field];
  return value == null ? "" : String(value).trim();
}

/** Read an uploaded spreadsheet into form-shaped rows (not yet validated). */
export async function parseClientsFile(file: File): Promise<RawImportRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const ws = wb.Sheets[firstSheet];
  if (!ws) return [];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  if (matrix.length < 1) return [];

  const headerRow = (matrix[0] ?? []).map((h) => normalizeHeader(String(h ?? "")));
  const colToField = new Map<number, Field>();
  headerRow.forEach((h, idx) => {
    const field = HEADER_TO_FIELD.get(h);
    if (field) colToField.set(idx, field);
  });

  const rows: RawImportRow[] = [];
  for (let r = 1; r < matrix.length; r += 1) {
    const cols = matrix[r] ?? [];
    const raw: Partial<Record<Field, unknown>> = {};
    colToField.forEach((field, idx) => {
      raw[field] = cols[idx];
    });

    // Skip fully empty rows.
    if (Object.values(raw).every((v) => String(v ?? "").trim() === "")) continue;

    rows.push({
      rowNumber: r,
      values: {
        biz_name: cell(raw, "biz_name"),
        biz_reg_no: cell(raw, "biz_reg_no"),
        ceo_name: cell(raw, "ceo_name"),
        industry: cell(raw, "industry"),
        tax_type: toTaxType(cell(raw, "tax_type")),
        closing_month: toClosingMonth(cell(raw, "closing_month")),
        is_semiannual_withholding: toBool(cell(raw, "is_semiannual_withholding")),
        is_diligent_filing: toBool(cell(raw, "is_diligent_filing")),
        contact_phone: cell(raw, "contact_phone"),
        contact_kakao: cell(raw, "contact_kakao"),
        contact_email: cell(raw, "contact_email"),
        status: toStatus(cell(raw, "status")),
        memo: cell(raw, "memo"),
      },
    });
  }
  return rows;
}
