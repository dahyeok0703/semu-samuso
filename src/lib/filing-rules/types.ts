import type { ISODate } from "@/lib/filing-rules/dates";
import type { FilingCategory, FilingTypeCode } from "@/lib/filing-rules/filing-types";
import type { TaxType } from "@/types/database.types";

/** The subset of a client's attributes that drives schedule generation. */
export type ClientForRules = {
  taxType: TaxType | null;
  closingMonth: number;
  isSemiannualWithholding: boolean;
  isDiligentFiling: boolean;
};

/** A rule's raw output before business-day adjustment / metadata enrichment. */
export type RuleTask = {
  filingType: FilingTypeCode;
  periodLabel: string;
  baseDueDate: ISODate;
};

export type RuleContext = { year: number; client: ClientForRules };

export type RuleBuilder = (ctx: RuleContext) => RuleTask[];

/** A fully-resolved planned task (engine output). Pure data — no DB ids. */
export type PlannedTask = {
  filingType: FilingTypeCode;
  category: FilingCategory;
  label: string;
  periodLabel: string;
  /** Statutory date before weekend/holiday adjustment. */
  baseDueDate: ISODate;
  /** Final due date after business-day adjustment. */
  dueDate: ISODate;
  expectedDocuments: string[];
};
