"use client";

import { CalendarClock, FileText, Send } from "lucide-react";

import { AssignmentManager } from "@/app/(app)/clients/[id]/_components/assignment-manager";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBizRegNo } from "@/lib/clients/biz-reg-no";
import { CLIENT_STATUS_LABELS, TAX_TYPE_LABELS } from "@/lib/clients/constants";
import type { WorkspaceMember } from "@/lib/clients/queries";
import type {
  Client,
  DocsStatus,
  DocumentSource,
  DocumentStatus,
  FilingStatus,
  ReminderChannel,
  ReminderStatus,
} from "@/types/database.types";

type FilingTaskLite = {
  id: string;
  filing_type: string;
  period_label: string;
  due_date: string | null;
  status: FilingStatus;
  docs_status: DocsStatus;
};
type DocumentLite = {
  id: string;
  doc_type: string | null;
  source: DocumentSource;
  status: DocumentStatus;
  received_at: string;
};
type ReminderLite = {
  id: string;
  channel: ReminderChannel;
  template_key: string;
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
};

const FILING_STATUS: Record<FilingStatus, string> = {
  pending: "대기",
  docs_received: "자료 수취",
  filed: "신고 완료",
  done: "완료",
};
const DOCS_STATUS: Record<DocsStatus, string> = {
  missing: "미수취",
  partial: "일부",
  complete: "완료",
};
const DOC_SOURCE: Record<DocumentSource, string> = {
  upload: "업로드",
  email: "이메일",
  kakao: "카카오",
  codef: "스크래핑",
};
const DOC_STATUS: Record<DocumentStatus, string> = {
  pending_review: "검토 대기",
  confirmed: "확정",
};
const REMINDER_CHANNEL: Record<ReminderChannel, string> = {
  email: "이메일",
  inapp: "인앱",
  kakao: "카카오",
  sms: "SMS",
};
const REMINDER_STATUS: Record<ReminderStatus, string> = {
  queued: "대기",
  sent: "발송됨",
  failed: "실패",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR");
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function ClientDetailTabs({
  client,
  members,
  assigneeIds,
  canEditAssignments,
  filingTasks,
  documents,
  reminders,
}: {
  client: Client;
  members: WorkspaceMember[];
  assigneeIds: string[];
  canEditAssignments: boolean;
  filingTasks: FilingTaskLite[];
  documents: DocumentLite[];
  reminders: ReminderLite[];
}) {
  return (
    <Tabs defaultValue="filings" className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
        <TabsTrigger value="filings">신고 일정</TabsTrigger>
        <TabsTrigger value="documents">수취 자료</TabsTrigger>
        <TabsTrigger value="reminders">독촉 이력</TabsTrigger>
        <TabsTrigger value="info">정보</TabsTrigger>
      </TabsList>

      {/* 신고 일정 */}
      <TabsContent value="filings">
        {filingTasks.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="등록된 신고 일정이 없습니다"
            description="부가세·종소세 등 신고 업무는 다음 단계(신고 관리)에서 이 거래처와 연동됩니다."
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {filingTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">{t.period_label}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.filing_type} · 마감 {fmtDate(t.due_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted">자료 {DOCS_STATUS[t.docs_status]}</Badge>
                  <Badge variant="outline">{FILING_STATUS[t.status]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      {/* 수취 자료 */}
      <TabsContent value="documents">
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="수취한 자료가 없습니다"
            description="업로드·이메일·카카오·스크래핑으로 수집된 서류가 다음 단계에서 이곳에 표시됩니다."
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">{d.doc_type ?? "미분류 서류"}</p>
                  <p className="text-xs text-muted-foreground">
                    {DOC_SOURCE[d.source]} · {fmtDate(d.received_at)}
                  </p>
                </div>
                <Badge variant={d.status === "confirmed" ? "success" : "warning"}>
                  {DOC_STATUS[d.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      {/* 독촉 이력 */}
      <TabsContent value="reminders">
        {reminders.length === 0 ? (
          <EmptyState
            icon={Send}
            title="독촉 이력이 없습니다"
            description="자료 요청·마감 알림 발송 기록이 다음 단계(리마인더)에서 이곳에 쌓입니다."
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">{r.template_key}</p>
                  <p className="text-xs text-muted-foreground">
                    {REMINDER_CHANNEL[r.channel]} · {fmtDate(r.sent_at ?? r.created_at)}
                  </p>
                </div>
                <Badge
                  variant={
                    r.status === "sent" ? "success" : r.status === "failed" ? "destructive" : "muted"
                  }
                >
                  {REMINDER_STATUS[r.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      {/* 정보 */}
      <TabsContent value="info" className="space-y-6">
        <div className="rounded-xl border p-4">
          <h3 className="mb-2 text-sm font-semibold">담당자</h3>
          <AssignmentManager
            clientId={client.id}
            members={members}
            assigneeIds={assigneeIds}
            canEdit={canEditAssignments}
          />
        </div>

        <div className="rounded-xl border p-4">
          <h3 className="mb-1 text-sm font-semibold">기본 정보</h3>
          <dl className="divide-y">
            <InfoRow
              label="사업자등록번호"
              value={client.biz_reg_no ? formatBizRegNo(client.biz_reg_no) : "—"}
            />
            <InfoRow label="대표자" value={client.ceo_name ?? "—"} />
            <InfoRow label="업종" value={client.industry ?? "—"} />
            <InfoRow
              label="과세유형"
              value={client.tax_type ? TAX_TYPE_LABELS[client.tax_type] : "—"}
            />
            <InfoRow label="결산월" value={`${client.closing_month}월`} />
            <InfoRow
              label="신고 옵션"
              value={
                <span className="flex gap-1">
                  {client.is_semiannual_withholding ? (
                    <Badge variant="outline">반기 원천</Badge>
                  ) : null}
                  {client.is_diligent_filing ? <Badge variant="outline">성실신고</Badge> : null}
                  {!client.is_semiannual_withholding && !client.is_diligent_filing ? "—" : null}
                </span>
              }
            />
            <InfoRow label="상태" value={CLIENT_STATUS_LABELS[client.status]} />
          </dl>
        </div>

        <div className="rounded-xl border p-4">
          <h3 className="mb-1 text-sm font-semibold">연락처</h3>
          <dl className="divide-y">
            <InfoRow label="전화" value={client.contact_phone ?? "—"} />
            <InfoRow label="카카오" value={client.contact_kakao ?? "—"} />
            <InfoRow label="이메일" value={client.contact_email ?? "—"} />
          </dl>
        </div>

        {client.memo ? (
          <div className="rounded-xl border p-4">
            <h3 className="mb-2 text-sm font-semibold">메모</h3>
            <Separator className="mb-3" />
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{client.memo}</p>
          </div>
        ) : null}
      </TabsContent>
    </Tabs>
  );
}
