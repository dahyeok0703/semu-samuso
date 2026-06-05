/**
 * 독촉 템플릿 (변수: 거래처 호칭/마감일/필요서류/잔여일). 채널별로 적절히 렌더링한다.
 * 채널 텍스트가 깨지지 않도록 client-facing(email/sms)과 staff-facing(inapp)을 구분.
 *
 * 카카오 알림톡 본문은 카카오에 사전 등록된 템플릿을 사용하므로, 여기서는 치환 변수
 * 만 만든다(템플릿 id 는 설정값 SOLAPI_KAKAO_TEMPLATE_ID).
 */

export const REMINDER_TEMPLATE_KEY = "docs_missing";

export const REMINDER_TEMPLATES: Record<string, { label: string }> = {
  [REMINDER_TEMPLATE_KEY]: { label: "자료 미제출 안내" },
};

export function templateLabel(key: string): string {
  return REMINDER_TEMPLATES[key]?.label ?? key;
}

export type ReminderVars = {
  officeName: string; // 사무소명
  clientName: string; // 거래처 상호
  contactName: string; // 호칭 (예: "가나다상사 담당자님")
  dueDateLabel: string; // 마감일 (사람이 읽는 형식)
  filingLabel: string; // 신고 명칭 + 기간
  missingDocs: string[]; // 필요(미제출) 서류
  daysLeft: number; // 잔여일
};

export type RenderedReminder = {
  subject: string;
  clientBody: string; // email 본문
  smsBody: string; // sms 본문 (짧게)
  inappTitle: string; // 직원용 인앱 알림 제목
  inappBody: string; // 직원용 인앱 알림 본문
  kakaoVariables: Record<string, string>; // 알림톡 치환 변수
};

function docsList(missing: string[], max = 99): string {
  if (missing.length === 0) return "(미제출 서류 확인 필요)";
  return missing
    .slice(0, max)
    .map((d) => `- ${d}`)
    .join("\n");
}

export function renderReminder(vars: ReminderVars): RenderedReminder {
  const { officeName, clientName, contactName, dueDateLabel, filingLabel, missingDocs, daysLeft } =
    vars;

  const subject = `[${filingLabel}] 자료 제출 안내 (마감 D-${daysLeft})`;

  const clientBody = [
    `${contactName}, 안녕하세요. ${officeName}입니다.`,
    ``,
    `${filingLabel} 신고 준비를 위해 아직 받지 못한 자료가 있어 안내드립니다.`,
    `· 마감일: ${dueDateLabel} (D-${daysLeft})`,
    ``,
    `[미제출 자료]`,
    docsList(missingDocs),
    ``,
    `위 자료를 회신해 주시면 신고에 반영하겠습니다. 감사합니다.`,
  ].join("\n");

  const smsBody =
    `[${officeName}] ${clientName} ${filingLabel} 자료 미제출 안내. ` +
    `마감 ${dueDateLabel}(D-${daysLeft}). 미제출: ${missingDocs.slice(0, 3).join(", ") || "확인 요망"}`;

  const inappTitle = `자료 미제출: ${clientName}`;
  const inappBody = `${filingLabel} 마감 ${dueDateLabel} (D-${daysLeft}) · 미제출 ${missingDocs.length}건`;

  const kakaoVariables = {
    "#{고객명}": contactName,
    "#{사무소명}": officeName,
    "#{신고명}": filingLabel,
    "#{마감일}": dueDateLabel,
    "#{잔여일}": String(daysLeft),
    "#{필요서류}": missingDocs.join(", ") || "확인 요망",
  };

  return { subject, clientBody, smsBody, inappTitle, inappBody, kakaoVariables };
}
