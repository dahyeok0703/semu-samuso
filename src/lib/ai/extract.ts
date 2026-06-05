import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

/**
 * 문서 → Claude content block 변환. 비용 절감을 위한 분기:
 *  - 이미지/스캔(image/*) → vision(image block)
 *  - 텍스트가 추출되는 PDF → 텍스트만 전송(저렴)
 *  - 텍스트가 거의 없는(스캔) PDF → document(base64) 로 전송해 vision 처리
 *  - 그 외(txt 등) → 텍스트
 *
 * ★PII 최소: 분류에 필요한 만큼만 전송한다(텍스트 PDF는 상한까지만 잘라 전송).
 */

export type PreparedContent = {
  blocks: Anthropic.ContentBlockParam[];
  mode: "text" | "vision" | "pdf";
};

const IMAGE_TYPES: Record<string, Anthropic.Base64ImageSource["media_type"]> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
};

const MAX_TEXT_CHARS = 24_000; // token guard for very large text PDFs
const MIN_PDF_TEXT_CHARS = 200; // below this → treat as scanned, use vision

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** Extract embedded text from a PDF; returns "" on failure (→ vision fallback). */
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    // unpdf is serverless-friendly and has no fs side effects on import.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text).trim();
  } catch {
    return "";
  }
}

export async function prepareDocumentContent(
  bytes: Uint8Array,
  contentType: string,
  fileName: string,
): Promise<PreparedContent> {
  const type = contentType.toLowerCase();

  const imageMedia = IMAGE_TYPES[type];
  if (imageMedia) {
    return {
      mode: "vision",
      blocks: [
        {
          type: "image",
          source: { type: "base64", media_type: imageMedia, data: toBase64(bytes) },
        },
      ],
    };
  }

  if (type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    const text = await extractPdfText(bytes);
    if (text.length >= MIN_PDF_TEXT_CHARS) {
      return {
        mode: "text",
        blocks: [
          {
            type: "text",
            text: `다음은 PDF에서 추출한 텍스트입니다(${fileName}):\n\n${text.slice(0, MAX_TEXT_CHARS)}`,
          },
        ],
      };
    }
    // Scanned / image-only PDF → send the document for vision processing.
    return {
      mode: "pdf",
      blocks: [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: toBase64(bytes) },
        },
      ],
    };
  }

  // Plain text / unknown → decode as UTF-8 text.
  const text = Buffer.from(bytes).toString("utf8").slice(0, MAX_TEXT_CHARS);
  return {
    mode: "text",
    blocks: [{ type: "text", text: `다음은 서류 텍스트입니다(${fileName}):\n\n${text}` }],
  };
}
