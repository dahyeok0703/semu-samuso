import { z } from "zod";

import { DOC_TYPES } from "@/lib/ai/doc-types";

export const registerDocumentSchema = z.object({
  clientId: z.string().uuid(),
  filePath: z.string().min(1),
  fileName: z.string().min(1).max(300),
  contentType: z.string().max(120).default("application/octet-stream"),
});

export const classifyRequestSchema = z.object({
  documentId: z.string().uuid(),
});

export const confirmDocumentSchema = z.object({
  documentId: z.string().uuid(),
  docType: z.enum(DOC_TYPES),
  taskId: z.string().uuid().nullable().default(null),
});

export const linkDocumentTaskSchema = z.object({
  documentId: z.string().uuid(),
  taskId: z.string().uuid().nullable(),
});

export const deleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
});
