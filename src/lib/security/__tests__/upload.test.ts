import { describe, expect, it } from "vitest";

import {
  isAllowedMime,
  isValidObjectPath,
  MAX_UPLOAD_BYTES,
  validateUpload,
} from "@/lib/security/upload";

const WS = "11111111-1111-1111-1111-111111111111";

describe("validateUpload", () => {
  it("accepts allowed types within the size cap", () => {
    expect(validateUpload({ contentType: "application/pdf", size: 1000 }).ok).toBe(true);
    expect(validateUpload({ contentType: "image/png", size: 1000 }).ok).toBe(true);
    expect(validateUpload({ contentType: "image/jpeg; charset=binary", size: 1 }).ok).toBe(true);
  });

  it("rejects disallowed MIME types", () => {
    expect(validateUpload({ contentType: "application/zip", size: 10 }).ok).toBe(false);
    expect(validateUpload({ contentType: "text/html", size: 10 }).ok).toBe(false);
    expect(validateUpload({ contentType: "application/x-msdownload", size: 10 }).ok).toBe(false);
  });

  it("rejects oversize and empty files", () => {
    expect(validateUpload({ contentType: "application/pdf", size: MAX_UPLOAD_BYTES + 1 }).ok).toBe(
      false,
    );
    expect(validateUpload({ contentType: "application/pdf", size: 0 }).ok).toBe(false);
  });
});

describe("isValidObjectPath", () => {
  it("accepts paths under the workspace prefix", () => {
    expect(isValidObjectPath(`${WS}/client/abc-file.pdf`, WS)).toBe(true);
  });

  it("rejects other-workspace prefixes and traversal", () => {
    expect(isValidObjectPath(`other-ws/client/file.pdf`, WS)).toBe(false);
    expect(isValidObjectPath(`${WS}/../secret/file.pdf`, WS)).toBe(false);
    expect(isValidObjectPath(`/etc/passwd`, WS)).toBe(false);
    expect(isValidObjectPath(`${WS}\\client\\file.pdf`, WS)).toBe(false);
  });
});

describe("isAllowedMime", () => {
  it("ignores charset parameters", () => {
    expect(isAllowedMime("application/pdf; charset=utf-8")).toBe(true);
    expect(isAllowedMime("application/octet-stream")).toBe(false);
  });
});
