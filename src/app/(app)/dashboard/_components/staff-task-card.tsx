"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DOCS_STATUS_BADGE,
  DOCS_STATUS_LABELS,
  FILING_STATUS_LABELS,
  FILING_STATUS_OPTIONS,
} from "@/lib/filings/constants";
import { updateFilingTaskStatusAction } from "@/lib/filings/actions";
import type { StaffTask } from "@/lib/dashboard/queries";
import type { FilingStatus } from "@/types/database.types";

function dueBadge(daysLeft: number) {
  if (daysLeft < 0) return <Badge variant="destructive">기한 경과 {-daysLeft}일</Badge>;
  if (daysLeft === 0) return <Badge variant="warning">오늘 마감</Badge>;
  return <Badge variant={daysLeft <= 3 ? "warning" : "muted"}>D-{daysLeft}</Badge>;
}

export function StaffTaskCard({ task }: { task: StaffTask }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function changeStatus(status: FilingStatus) {
    startTransition(async () => {
      const res = await updateFilingTaskStatusAction({ id: task.taskId, status });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`상태를 '${FILING_STATUS_LABELS[status]}'(으)로 변경했습니다.`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/clients/${task.clientId}`}
              className="font-medium hover:underline focus:underline focus:outline-none"
            >
              {task.clientName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{task.filingLabel}</p>
          </div>
          {dueBadge(task.daysLeft)}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" />
          마감{" "}
          {new Date(`${task.dueDate}T00:00:00Z`).toLocaleDateString("ko-KR", { timeZone: "UTC" })}
          <Badge variant={DOCS_STATUS_BADGE[task.docsStatus as keyof typeof DOCS_STATUS_BADGE]}>
            자료 {DOCS_STATUS_LABELS[task.docsStatus as keyof typeof DOCS_STATUS_LABELS]}
          </Badge>
        </p>

        {task.missingDocs.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {task.missingDocs.slice(0, 4).map((d) => (
              <span
                key={d}
                className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              >
                {d}
              </span>
            ))}
            {task.missingDocs.length > 4 ? (
              <span className="text-[11px] text-muted-foreground">
                외 {task.missingDocs.length - 4}건
              </span>
            ) : null}
          </div>
        ) : null}

        <Select
          value={task.status}
          onValueChange={(v) => changeStatus(v as FilingStatus)}
          disabled={isPending}
        >
          <SelectTrigger className="h-8" aria-label="상태 변경">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILING_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
