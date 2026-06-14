/**
 * Upload constraints (pure, shared by the browser uploader and the server-side
 * document registration). Mirrors the Storage bucket limits enforced in SQL
 * (migration 0013) so we reject early with a friendly message.
 */

/** Allowed document MIME types (PDF + common images). */
export const ALLOWED_UPLOAD_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/** Max single-file size: 20 MB. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type UploadCheck = { ok: true } | { ok: false; reason: string };

/** Validate a file's MIME type and size before upload. */
export function validateUpload(input: { contentType: string; size: number }): UploadCheck {
  const type = input.contentType.split(";")[0]!.trim().toLowerCase();
  if (!ALLOWED_UPLOAD_MIME.includes(type as (typeof ALLOWED_UPLOAD_MIME)[number])) {
    return { ok: false, reason: "PDF·이미지(JPG/PNG/WEBP/GIF) 파일만 업로드할 수 있습니다." };
  }
  if (input.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "파일 크기는 20MB를 넘을 수 없습니다." };
  }
  if (input.size <= 0) {
    return { ok: false, reason: "빈 파일은 업로드할 수 없습니다." };
  }
  return { ok: true };
}

/**
 * Validate a Storage object path supplied by the client when registering a
 * document. Must live under the caller's workspace prefix and contain no path
 * traversal. (Storage RLS also enforces the workspace prefix; this is
 * defence-in-depth + data integrity.)
 */
export function isValidObjectPath(filePath: string, workspaceId: string): boolean {
  if (filePath.includes("..") || filePath.includes("\\")) return false;
  if (filePath.startsWith("/")) return false;
  return filePath.startsWith(`${workspaceId}/`);
}

/** Whether a MIME type is an accepted upload type. */
export function isAllowedMime(contentType: string): boolean {
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  return ALLOWED_UPLOAD_MIME.includes(type as (typeof ALLOWED_UPLOAD_MIME)[number]);
}
