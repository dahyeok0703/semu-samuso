import type { Metadata } from "next";

import { CalendarView } from "@/app/(app)/calendar/_components/calendar-view";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth/session";
import { listWorkspaceMembers } from "@/lib/clients/queries";
import { calendarGridRange, listCalendarTasks } from "@/lib/filings/queries";
import { calendarParamsSchema } from "@/lib/filings/schemas";

export const metadata: Metadata = { title: "신고 캘린더" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const raw = await searchParams;
  const params = calendarParamsSchema.parse(raw);

  const { start, end } = calendarGridRange(params.year, params.month);
  const [members, tasks] = await Promise.all([
    listWorkspaceMembers(),
    listCalendarTasks(start, end, {
      assigned: params.assigned,
      category: params.category,
      status: params.status,
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="신고 캘린더" description="전사 신고 마감을 한눈에 관리합니다." />
      <CalendarView
        year={params.year}
        month={params.month}
        view={params.view}
        tasks={tasks}
        members={members}
        isOwner={session.member.role === "owner"}
      />
    </div>
  );
}
