/** Korean labels for known audit actions (client-safe). Unknown → shown raw. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "client.created": "거래처 등록",
  "client.updated": "거래처 수정",
  "client.status_changed": "거래처 상태 변경",
  "client.ended": "거래처 해지",
  "client.deleted": "거래처 삭제",
  "client.assignments_set": "담당자 변경",
  "client.bulk_imported": "거래처 일괄 등록",
  "client.bulk_reassigned": "거래처 일괄 재배정",
  "filing.schedule_generated": "신고 일정 생성",
  "filing.schedule_batch_generated": "신고 일정 일괄 생성",
  "filing.status_changed": "신고 상태 변경",
  "filing.docs_status_changed": "자료 상태 변경",
  "filing.document_toggled": "제출서류 체크",
  "document.uploaded": "자료 업로드",
  "document.confirmed": "분류 확정",
  "document.reclassified": "분류 교정",
  "document.deleted": "자료 삭제",
  "ai.classified": "AI 자동 분류",
  "reminder.sent": "독촉 발송",
  "reminder.settings_updated": "리마인더 설정 변경",
  "member.invited": "직원 초대",
  "member.invite_resent": "초대 재발송",
  "member.invite_revoked": "초대 취소",
  "member.role_changed": "역할 변경",
  "member.activated": "직원 활성화",
  "member.deactivated": "직원 비활성화",
  "member.joined": "직원 합류",
  "onboarding.completed": "온보딩 완료",
  "billing.trial_started": "무료체험 시작",
  "billing.subscribed": "구독 시작",
  "billing.plan_changed": "플랜 변경",
  "billing.method_updated": "결제수단 변경",
  "billing.canceled": "구독 취소",
  "billing.resumed": "구독 재개",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({
  value,
  label,
}));
