import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BulkReassign } from "@/app/(app)/team/_components/bulk-reassign";
import { InviteForm } from "@/app/(app)/team/_components/invite-form";
import { InviteRow } from "@/app/(app)/team/_components/invite-row";
import { MemberRow } from "@/app/(app)/team/_components/member-row";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { listWorkspaceMembers } from "@/lib/clients/queries";
import { listClientsWithAssignees, listMembers, listPendingInvites } from "@/lib/team/queries";

export const metadata: Metadata = { title: "팀" };

export default async function TeamPage() {
  const session = await requireSession();
  if (session.member.role !== "owner") redirect("/dashboard");

  const [members, invites, clients, workspaceMembers] = await Promise.all([
    listMembers(),
    listPendingInvites(),
    listClientsWithAssignees(),
    listWorkspaceMembers(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="팀" description="직원 초대·역할·담당 배정을 관리합니다." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">직원 ({members.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {members.map((m) => (
                <MemberRow key={m.id} member={m} isSelf={m.id === session.member.id} />
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">직원 초대</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InviteForm />
            {invites.length > 0 ? (
              <div className="rounded-lg border">
                <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                  대기 중인 초대 ({invites.length})
                </p>
                <ul className="divide-y">
                  {invites.map((i) => (
                    <InviteRow key={i.id} invite={i} />
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">대기 중인 초대가 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">거래처 일괄 재배정</CardTitle>
        </CardHeader>
        <CardContent>
          <BulkReassign clients={clients} members={workspaceMembers} />
        </CardContent>
      </Card>
    </div>
  );
}
