import { describe, expect, it } from "vitest";

import { erpClientsToImportRows, normalizeErpClients } from "@/lib/integrations/erp-import/parsers";

describe("normalizeErpClients", () => {
  it("maps 더존/세무사랑 style headers via aliases", () => {
    const rows = [
      {
        거래처명: "가나다상사",
        사업자등록번호: "123-45-67890",
        대표자명: "홍길동",
        업태: "도매",
        연락처: "02-123-4567",
        이메일: "a@b.com",
      },
    ];
    const { clients, skipped } = normalizeErpClients(rows);
    expect(skipped).toBe(0);
    expect(clients[0]).toEqual({
      biz_name: "가나다상사",
      biz_reg_no: "1234567890", // digits only
      ceo_name: "홍길동",
      industry: "도매",
      contact_phone: "02-123-4567",
      contact_email: "a@b.com",
    });
  });

  it("accepts alternative header names (상호/사업자번호)", () => {
    const { clients } = normalizeErpClients([{ 상호: "라마바", 사업자번호: "1112233334" }]);
    expect(clients[0]?.biz_name).toBe("라마바");
    expect(clients[0]?.biz_reg_no).toBe("1112233334");
  });

  it("ignores spacing/case in headers", () => {
    const { clients } = normalizeErpClients([{ " 거 래 처 명 ": "스페이스상사" }]);
    expect(clients[0]?.biz_name).toBe("스페이스상사");
  });

  it("skips rows without a recognizable 상호", () => {
    const { clients, skipped } = normalizeErpClients([
      { 사업자등록번호: "1234567890" },
      { 거래처명: "정상" },
    ]);
    expect(clients).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it("returns empty for empty input", () => {
    expect(normalizeErpClients([])).toEqual({ clients: [], skipped: 0 });
  });
});

describe("erpClientsToImportRows", () => {
  it("produces the client bulk-import row shape with blanks for missing fields", () => {
    const rows = erpClientsToImportRows([{ biz_name: "단순상사" }]);
    expect(rows[0]).toMatchObject({
      biz_name: "단순상사",
      biz_reg_no: "",
      ceo_name: "",
      contact_email: "",
    });
  });
});
