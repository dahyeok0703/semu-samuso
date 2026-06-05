import { z } from "zod";

const FILING_STATUSES = ["pending", "docs_received", "filed", "done"] as const;
const DOCS_STATUSES = ["missing", "partial", "complete"] as const;

const yearField = z.coerce
  .number()
  .int()
  .min(2000, "연도를 확인해 주세요.")
  .max(2100, "연도를 확인해 주세요.");

export const generateClientScheduleSchema = z.object({
  clientId: z.string().uuid(),
  year: yearField,
});

export const generateWorkspaceScheduleSchema = z.object({
  year: yearField,
});

export const updateFilingTaskStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(FILING_STATUSES),
});

export const updateFilingTaskDocsStatusSchema = z.object({
  id: z.string().uuid(),
  docs_status: z.enum(DOCS_STATUSES),
});

export const toggleExpectedDocumentSchema = z.object({
  id: z.string().uuid(),
  is_received: z.boolean(),
});

/** Calendar page query-param parser (tolerant of junk via .catch). */
const FILING_CATEGORIES = [
  "vat",
  "vat_simplified",
  "exempt_status",
  "withholding",
  "income",
  "corporate",
  "payment_statement",
] as const;

export const calendarParamsSchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .catch(() => new Date().getUTCFullYear()),
  month: z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .catch(() => new Date().getUTCMonth() + 1),
  assigned: z.string().uuid().optional().catch(undefined),
  category: z.enum(FILING_CATEGORIES).optional().catch(undefined),
  status: z.enum(FILING_STATUSES).optional().catch(undefined),
  view: z.enum(["calendar", "list"]).catch("calendar"),
});

export type CalendarParams = z.infer<typeof calendarParamsSchema>;
