/**
 * 더존 스마트A · 세무사랑Pro 등 ERP 내보내기 파일 파서 (pure, testable).
 *
 * ERP마다 헤더 명칭이 달라 별칭 매핑으로 흡수한다. 파일(엑셀/CSV) → 행 객체 변환은
 * 호출부(클라이언트, xlsx)에서 수행하고, 여기서는 행 객체를 거래처 표준형으로 정규화한다.
 * 정규화 결과는 기존 거래처 일괄 등록(bulkImportClientsAction) 으로 그대로 흘려보낸다.
 */

export type ErpClient = {
  biz_name: string;
  biz_reg_no?: string;
  ceo_name?: string;
  industry?: string;
  contact_phone?: string;
  contact_email?: string;
};

export type ErpParseResult = {
  clients: ErpClient[];
  /** biz_name 을 찾지 못해 건너뛴 행 수. */
  skipped: number;
};

// 표준 필드 → ERP 헤더 별칭(공백/대소문자 무시 비교).
const HEADER_ALIASES: Record<keyof ErpClient, string[]> = {
  biz_name: ["상호", "상호명", "거래처명", "거래처", "회사명", "사업장명", "업체명"],
  biz_reg_no: ["사업자등록번호", "사업자번호", "등록번호", "사업자등록no"],
  ceo_name: ["대표자", "대표자명", "대표", "성명", "대표이사"],
  industry: ["업종", "업태", "종목"],
  contact_phone: ["전화번호", "전화", "연락처", "휴대폰", "핸드폰", "tel", "phone"],
  contact_email: ["이메일", "email", "e-mail", "메일"],
};

function norm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/** Build a header → field map from the row keys (first match wins). */
function buildHeaderMap(headers: string[]): Partial<Record<string, keyof ErpClient>> {
  const map: Partial<Record<string, keyof ErpClient>> = {};
  for (const header of headers) {
    const h = norm(header);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
      keyof ErpClient,
      string[],
    ][]) {
      if (aliases.some((a) => norm(a) === h)) {
        map[header] = field;
        break;
      }
    }
  }
  return map;
}

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

/**
 * Normalize parsed rows (array of `{ header: value }`) into client records.
 * Rows without a recognizable 상호 are skipped.
 */
export function normalizeErpClients(rows: Array<Record<string, unknown>>): ErpParseResult {
  if (rows.length === 0) return { clients: [], skipped: 0 };

  // Union of keys across rows (export files share headers; be robust anyway).
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const headerMap = buildHeaderMap(headers);

  const clients: ErpClient[] = [];
  let skipped = 0;

  for (const row of rows) {
    const rec: Partial<ErpClient> = {};
    for (const [header, field] of Object.entries(headerMap)) {
      const raw = row[header];
      const value = raw == null ? "" : String(raw).trim();
      if (!value || !field) continue;
      rec[field] = field === "biz_reg_no" ? digitsOnly(value) : value;
    }

    if (!rec.biz_name) {
      skipped += 1;
      continue;
    }
    clients.push(rec as ErpClient);
  }

  return { clients, skipped };
}

/** Map normalized ERP clients to the client bulk-import row shape. */
export function erpClientsToImportRows(clients: ErpClient[]): Array<Record<string, unknown>> {
  return clients.map((c) => ({
    biz_name: c.biz_name,
    biz_reg_no: c.biz_reg_no ?? "",
    ceo_name: c.ceo_name ?? "",
    industry: c.industry ?? "",
    contact_phone: c.contact_phone ?? "",
    contact_email: c.contact_email ?? "",
  }));
}
