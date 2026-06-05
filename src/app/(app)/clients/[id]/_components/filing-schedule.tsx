"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarPlus, ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FILING_SCHEDULE_DISCLAIMER } from "@/lib/filing-rules/engine";
import { filingTypeLabel } from "@/lib/filing-rules/filing-types";
import {
  generateClientScheduleAction,
  toggleExpectedDocumentAction,
  updateFilingTaskStatusAction,
} from "@/lib/filings/actions";
import {
  DOCS_STATUS_BADGE,
  DOCS_STATUS_LABELS,
  FILING_STATUS_BADGE,
  FILING_STATUS_LABELS,
  IMMINENT_DAYS,
} from "@/lib/filings/constants";
import type { ScheduleTask } from "@/lib/filings/queries";
import type { FilingStatus } from "@/types/database.types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(iso: string): number {
  const a = Date.parse(`${iso}T00:00:00Z`);
  const b = Date.parse(`${todayISO()}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

function formatDue(iso: string | null): string {
  if (!iso) return "기한 미정";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });
}

function monthKey(iso: string | null): string {
  return iso ? iso.slice(0, 7) : "기한 미정";
}

function monthLabel(key: string): string {
  if (key === "기한 미정") return key;
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

const STATUSES: FilingStatus[] = ["pending", "docs_received", "filed", "done"];

function FilingTaskRow({ task, canWrite }: { task: ScheduleTask; canWrite: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const dleft = task.due_date ? daysUntil(task.due_date) : null;
  const done = task.status === "done" || task.status === "filed";
  const imminent = dleft !== null && dleft >= 0 && dleft <= IMMINENT_DAYS && !done;
  const overdue = dleft !== null && dleft < 0 && !done;

  const received = task.expectedDocuments.filter((d) => d.is_received).length;
  const total = task.expectedDocuments.length;

  function changeStatus(status: FilingStatus) {
    startTransition(async () => {
      const res = await updateFilingTaskStatusAction({ id: task.id, status });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`상태를 '${FILING_STATUS_LABELS[status]}'(으)로 변경했습니다.`);
      router.refresh();
    });
  }

  function toggleDoc(docId: string, isReceived: boolean) {
    startTransition(async () => {
      const res = await toggleExpectedDocumentAction({ id: docId, is_received: isReceived });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="rounded-lg border bg-card">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{filingTypeLabel(task.filing_type)}</span>
            <span className="text-xs text-muted-foreground">{task.period_label}</span>
            {imminent ? <Badge variant="warning">임박 D-{dleft}</Badge> : null}
            {overdue ? <Badge variant="destructive">기한 경과</Badge> : null}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {formatDue(task.due_date)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={DOCS_STATUS_BADGE[task.docs_status]}>
            자료 {DOCS_STATUS_LABELS[task.docs_status]}
            {total > 0 ? ` (${received}/${total})` : ""}
          </Badge>
          {canWrite ? (
            <Select
              value={task.status}
              onValueChange={(v) => changeStatus(v as FilingStatus)}
              disabled={isPending}
            >
              <SelectTrigger className="h-8 w-[130px]" aria-label="신고 상태 변경">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {FILING_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={FILING_STATUS_BADGE[task.status]}>
              {FILING_STATUS_LABELS[task.status]}
            </Badge>
          )}
          {total > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-expanded={open}
              aria-label="제출서류 펼치기"
              onClick={() => setOpen((o) => !o)}
            >
              <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </Button>
          ) : null}
        </div>
      </div>

      {open && total > 0 ? (
        <ul className="space-y-1 border-t p-3">
          {task.expectedDocuments.map((doc) => (
            <li key={doc.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={doc.is_received}
                  disabled={!canWrite || isPending}
                  onCheckedChange={(c) => toggleDoc(doc.id, c === true)}
                />
                <span className={doc.is_received ? "text-muted-foreground line-through" : ""}>
                  {doc.doc_type}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function FilingSchedule({
  clientId,
  schedule,
  canWrite,
  taxTypeSet,
}: {
  clientId: string;
  schedule: ScheduleTask[];
  canWrite: boolean;
  taxTypeSet: boolean;
}) {
  const router = useRouter();
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [isPending, startTransition] = useTransition();

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  const groups = useMemo(() => {
    const map = new Map<string, ScheduleTask[]>();
    for (const t of schedule) {
      const key = monthKey(t.due_date);
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [schedule]);

  function generate() {
    startTransition(async () => {
      const res = await generateClientScheduleAction({ clientId, year });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      const { created, skipped } = res.data;
      if (created === 0)
        toast.info(`${year}년 일정이 이미 모두 생성되어 있습니다. (중복 ${skipped}건 건너뜀)`);
      else
        toast.success(
          `${year}년 신고 일정 ${created}건을 생성했습니다.${skipped ? ` (중복 ${skipped}건 건너뜀)` : ""}`,
        );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-1.5 rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {FILING_SCHEDULE_DISCLAIMER}
      </p>

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <span className="text-sm font-medium">연도 일정 생성</span>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
            disabled={isPending}
          >
            <SelectTrigger className="h-8 w-[110px]" aria-label="생성 연도">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={generate} disabled={isPending || !taxTypeSet}>
            <CalendarPlus className="size-4" /> {isPending ? "생성 중…" : "생성 / 갱신"}
          </Button>
          {!taxTypeSet ? (
            <span className="text-xs text-amber-600">과세유형을 먼저 설정하세요.</span>
          ) : (
            <span className="text-xs text-muted-foreground">중복은 자동으로 건너뜁니다.</span>
          )}
        </div>
      ) : null}

      {schedule.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="생성된 신고 일정이 없습니다"
          description={
            taxTypeSet
              ? "‘연도 일정 생성’으로 이 거래처의 연간 신고 마감을 자동 생성하세요."
              : "과세유형을 설정한 뒤 신고 일정을 생성할 수 있습니다."
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map(([key, tasks]) => (
            <div key={key}>
              <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
                {monthLabel(key)}
              </h4>
              <ul className="space-y-2">
                {tasks.map((task) => (
                  <FilingTaskRow key={task.id} task={task} canWrite={canWrite} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
