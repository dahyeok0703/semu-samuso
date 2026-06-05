import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ClientDetailActions } from "@/app/(app)/clients/[id]/_components/client-detail-actions";
import { ClientDetailTabs } from "@/app/(app)/clients/[id]/_components/client-detail-tabs";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth/session";
import { formatBizRegNo } from "@/lib/clients/biz-reg-no";
import {
  CLIENT_STATUS_BADGE,
  CLIENT_STATUS_LABELS,
  TAX_TYPE_LABELS,
} from "@/lib/clients/constants";
import {
  getClientAssigneeIds,
  getClientById,
  getClientReminders,
  listWorkspaceMembers,
} from "@/lib/clients/queries";
import { listClientDocuments, listClientTaskOptions } from "@/lib/documents/queries";
import { features } from "@/lib/env";
import { getClientSchedule } from "@/lib/filings/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const client = await getClientById(id);
  return { title: client ? client.biz_name : "거래처" };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const client = await getClientById(id);
  if (!client) notFound();

  const [assigneeIds, members, schedule, documents, taskOptions, reminders] = await Promise.all([
    getClientAssigneeIds(id),
    listWorkspaceMembers(),
    getClientSchedule(id),
    listClientDocuments(id),
    listClientTaskOptions(id),
    getClientReminders(id),
  ]);

  const isOwner = session.member.role === "owner";
  const canEdit = isOwner || assigneeIds.includes(session.member.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> 거래처 목록
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{client.biz_name}</h1>
            <Badge variant={CLIENT_STATUS_BADGE[client.status]}>
              {CLIENT_STATUS_LABELS[client.status]}
            </Badge>
            {client.tax_type ? (
              <Badge variant="outline">{TAX_TYPE_LABELS[client.tax_type]}</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {client.biz_reg_no ? (
              <span className="font-mono">{formatBizRegNo(client.biz_reg_no)}</span>
            ) : (
              "사업자번호 미등록"
            )}
            {client.ceo_name ? ` · 대표 ${client.ceo_name}` : ""}
          </p>
        </div>

        <ClientDetailActions client={client} isOwner={isOwner} canEdit={canEdit} />
      </div>

      <ClientDetailTabs
        client={client}
        workspaceId={session.workspace.id}
        members={members}
        assigneeIds={assigneeIds}
        canEditAssignments={isOwner}
        canWriteFilings={canEdit}
        canWriteDocuments={canEdit}
        isOwner={isOwner}
        aiEnabled={features.aiClassification}
        schedule={schedule}
        documents={documents}
        taskOptions={taskOptions}
        reminders={reminders}
      />
    </div>
  );
}
