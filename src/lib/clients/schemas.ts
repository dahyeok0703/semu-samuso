import { z } from "zod";

import { digitsOnly, isValidBizRegNo } from "@/lib/clients/biz-reg-no";
import { CLIENT_SORTABLE_COLUMNS } from "@/lib/clients/constants";

const TAX_TYPES = ["general", "simplified", "exempt", "corporate"] as const;
const CLIENT_STATUSES = ["active", "paused", "ended"] as const;

const emailField = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, {
    message: "이메일 형식이 올바르지 않습니다.",
  });

const bizRegNoField = z
  .string()
  .trim()
  .refine((v) => v === "" || digitsOnly(v).length === 10, {
    message: "사업자등록번호는 10자리 숫자입니다.",
  })
  .refine((v) => v === "" || isValidBizRegNo(v), {
    message: "사업자등록번호 체크섬이 올바르지 않습니다.",
  });

/**
 * Validation-only schema (no type-changing transforms) so it can be shared by
 * react-hook-form and the server action wrapper. Normalisation to DB shape
 * (empty string → null, digits-only biz_reg_no) happens in the action handler.
 */
export const clientFormSchema = z.object({
  biz_name: z.string().trim().min(1, "상호를 입력해 주세요.").max(120, "상호가 너무 깁니다."),
  biz_reg_no: bizRegNoField,
  ceo_name: z.string().trim().max(60).default(""),
  industry: z.string().trim().max(120).default(""),
  tax_type: z.enum(TAX_TYPES).nullable().default(null),
  closing_month: z.coerce.number().int().min(1).max(12).default(12),
  is_semiannual_withholding: z.boolean().default(false),
  is_diligent_filing: z.boolean().default(false),
  contact_phone: z.string().trim().max(40).default(""),
  contact_kakao: z.string().trim().max(80).default(""),
  contact_email: emailField.default(""),
  status: z.enum(CLIENT_STATUSES).default("active"),
  memo: z.string().trim().max(2000).default(""),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const createClientSchema = clientFormSchema;

export const updateClientSchema = clientFormSchema.extend({
  id: z.string().uuid(),
});

export const updateClientStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(CLIENT_STATUSES),
});

export const deleteClientSchema = z.object({
  id: z.string().uuid(),
});

export const setAssignmentsSchema = z.object({
  clientId: z.string().uuid(),
  memberIds: z.array(z.string().uuid()),
});

/** A single row from the Excel bulk-import flow. */
export const bulkClientRowSchema = clientFormSchema;
export type BulkClientRow = z.infer<typeof bulkClientRowSchema>;

export const bulkImportSchema = z.object({
  rows: z
    .array(bulkClientRowSchema)
    .min(1, "등록할 거래처가 없습니다.")
    .max(1000, "한 번에 최대 1000건까지 등록할 수 있습니다."),
});

/**
 * Parser for list-page search params (server side). Every field is tolerant of
 * junk values (hand-edited URLs) via `.catch`, so the page never 500s on bad
 * query strings — it just falls back to sensible defaults.
 */
export const clientListParamsSchema = z.object({
  q: z.string().trim().catch(""),
  tax_type: z.enum(TAX_TYPES).optional().catch(undefined),
  status: z.enum(CLIENT_STATUSES).optional().catch(undefined),
  assigned: z.string().uuid().optional().catch(undefined),
  sort: z.enum(CLIENT_SORTABLE_COLUMNS).catch("created_at"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).catch(1),
});

export type ClientListParams = z.infer<typeof clientListParamsSchema>;
