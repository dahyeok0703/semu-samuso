import { ClipboardCheck } from "lucide-react";

import { StaffTaskCard } from "@/app/(app)/dashboard/_components/staff-task-card";
import { EmptyState } from "@/components/empty-state";
import { getStaffDashboard } from "@/lib/dashboard/queries";

export async function StaffDashboard({ memberId }: { memberId: string }) {
  const tasks = await getStaffDashboard(memberId);

  const today = tasks.filter((t) => t.daysLeft <= 0);
  const week = tasks.filter((t) => t.daysLeft > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-md bg-muted px-3 py-1.5">
          오늘·지연 <span className="font-semibold">{today.length}</span>
        </span>
        <span className="rounded-md bg-muted px-3 py-1.5">
          이번 주 <span className="font-semibold">{week.length}</span>
        </span>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="이번 주 할 일이 없습니다"
          description="배정된 거래처의 임박한 신고·누락 자료가 생기면 이곳에 표시됩니다."
        />
      ) : (
        <div className="space-y-6">
          {today.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-destructive">오늘·지연 ({today.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {today.map((t) => (
                  <StaffTaskCard key={t.taskId} task={t} />
                ))}
              </div>
            </section>
          ) : null}

          {week.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                이번 주 ({week.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {week.map((t) => (
                  <StaffTaskCard key={t.taskId} task={t} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
