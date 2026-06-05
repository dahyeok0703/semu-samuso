import type { Metadata } from "next";

import { OwnerDashboard } from "@/app/(app)/dashboard/_components/owner-dashboard";
import { StaffDashboard } from "@/app/(app)/dashboard/_components/staff-dashboard";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "대시보드" };

export default async function DashboardPage() {
  const session = await requireSession();
  const isOwner = session.member.role === "owner";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`안녕하세요, ${session.member.name}님`}
        description={
          isOwner
            ? `${session.workspace.name} 업무 현황입니다.`
            : "오늘과 이번 주, 내가 챙겨야 할 일입니다."
        }
      />

      {isOwner ? <OwnerDashboard /> : <StaffDashboard memberId={session.member.id} />}
    </div>
  );
}
