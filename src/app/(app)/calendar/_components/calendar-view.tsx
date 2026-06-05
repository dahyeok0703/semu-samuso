"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, ChevronLeft, ChevronRight, Info, List, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addDays, dayOfWeek, toISO } from "@/lib/filing-rules/dates";
import { FILING_SCHEDULE_DISCLAIMER } from "@/lib/filing-rules/engine";
import { FILING_CATEGORY_OPTIONS, filingTypeLabel } from "@/lib/filing-rules/filing-types";
import { generateWorkspaceScheduleAction } from "@/lib/filings/actions";
import {
  FILING_STATUS_LABELS,
  FILING_STATUS_OPTIONS,
  IMMINENT_DAYS,
} from "@/lib/filings/constants";
import type { CalendarTask } from "@/lib/filings/queries";
import type { WorkspaceMember } from "@/lib/clients/queries";
import { cn } from "@/lib/utils";

const ALL = "all";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysUntil(iso: string): number {
  return Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayISO()}T00:00:00Z`)) / 86_400_000,
  );
}

type Tone = "overdue" | "imminent" | "done" | "normal";
function toneFor(t: CalendarTask): Tone {
  const done = t.status === "done" || t.status === "filed";
  if (done) return "done";
  const d = daysUntil(t.due_date);
  if (d < 0) return "overdue";
  if (d <= IMMINENT_DAYS) return "imminent";
  return "normal";
}
const TONE_CHIP: Record<Tone, string> = {
  overdue: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  imminent: "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200",
  done: "bg-muted text-muted-foreground hover:bg-muted/80 line-through",
  normal: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
};

export function CalendarView({
  year,
  month,
  view,
  tasks,
  members,
  isOwner,
}: {
  year: number;
  month: number;
  view: "calendar" | "list";
  tasks: CalendarTask[];
  members: WorkspaceMember[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setParam(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "" || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function shiftMonth(delta: number) {
    const zero = month - 1 + delta;
    const y = year + Math.floor(zero / 12);
    const m = ((zero % 12) + 12) % 12;
    setParam({ year: String(y), month: String(m + 1) });
  }
  function goToday() {
    const now = new Date();
    setParam({ year: String(now.getUTCFullYear()), month: String(now.getUTCMonth() + 1) });
  }

  // Build the 6-week grid.
  const gridDays = useMemo(() => {
    const firstISO = toISO(year, month, 1);
    const start = addDays(firstISO, -dayOfWeek(firstISO));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [year, month]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const t of tasks) {
      const list = map.get(t.due_date) ?? [];
      list.push(t);
      map.set(t.due_date, list);
    }
    return map;
  }, [tasks]);

  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthTasks = useMemo(
    () => tasks.filter((t) => t.due_date.startsWith(monthPrefix)),
    [tasks, monthPrefix],
  );

  function runBatch() {
    startTransition(async () => {
      const res = await generateWorkspaceScheduleAction({ year });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      const { processed, created, skipped, skippedClients } = res.data;
      toast.success(
        `${year}년 일정 생성 완료 — 거래처 ${processed}곳, 신규 ${created}건, 중복 ${skipped}건` +
          (skippedClients ? `, 과세유형 미설정 ${skippedClients}곳 제외` : ""),
      );
      router.refresh();
    });
  }

  const chip = (t: CalendarTask) => (
    <Link
      key={t.id}
      href={`/clients/${t.client_id}`}
      title={`${t.client_name} · ${filingTypeLabel(t.filing_type)} (${t.period_label})`}
      className={cn(
        "block truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
        TONE_CHIP[toneFor(t)],
      )}
    >
      {t.client_name} · {filingTypeLabel(t.filing_type)}
    </Link>
  );

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-1.5 rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {FILING_SCHEDULE_DISCLAIMER}
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="이전 달">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-[120px] text-center text-lg font-semibold tabular-nums">
            {year}년 {month}월
          </div>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="다음 달">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            오늘
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button
            variant={view === "calendar" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setParam({ view: null })}
            aria-pressed={view === "calendar"}
          >
            <CalendarDays className="size-4" /> 달력
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setParam({ view: "list" })}
            aria-pressed={view === "list"}
          >
            <List className="size-4" /> 목록
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">담당</Label>
          <Select
            value={params.get("assigned") ?? ALL}
            onValueChange={(v) => setParam({ assigned: v })}
          >
            <SelectTrigger className="w-[150px]" aria-label="담당자 필터">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체 담당</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  {m.role === "owner" ? " (대표)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">유형</Label>
          <Select
            value={params.get("category") ?? ALL}
            onValueChange={(v) => setParam({ category: v })}
          >
            <SelectTrigger className="w-[150px]" aria-label="신고 유형 필터">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체 유형</SelectItem>
              {FILING_CATEGORY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">상태</Label>
          <Select
            value={params.get("status") ?? ALL}
            onValueChange={(v) => setParam({ status: v })}
          >
            <SelectTrigger className="w-[130px]" aria-label="상태 필터">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체 상태</SelectItem>
              {FILING_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isOwner ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="ml-auto" disabled={isPending}>
                <CalendarPlus className="size-4" /> {year}년 일정 일괄 생성
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{year}년 신고 일정을 일괄 생성할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  정상 상태의 모든 거래처에 대해 {year}년 신고 마감을 자동 생성합니다. 이미 생성된
                  항목은 건너뜁니다. 생성되는 마감일은 일반 케이스 기준 예시이며 세무사 검수가
                  필요합니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={runBatch}>생성</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      {/* Calendar grid */}
      {view === "calendar" ? (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 border-b text-center text-xs font-medium">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className={cn(
                    "py-2",
                    i === 0 && "text-destructive",
                    i === 6 && "text-blue-600 dark:text-blue-400",
                  )}
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {gridDays.map((day) => {
                const inMonth = day.startsWith(monthPrefix);
                const isToday = day === todayISO();
                const dayTasks = byDate.get(day) ?? [];
                const dow = dayOfWeek(day);
                return (
                  <div
                    key={day}
                    className={cn(
                      "min-h-[104px] border-b border-r p-1 [&:nth-child(7n)]:border-r-0",
                      !inMonth && "bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs",
                        !inMonth && "text-muted-foreground",
                        dow === 0 && inMonth && "text-destructive",
                        dow === 6 && inMonth && "text-blue-600 dark:text-blue-400",
                        isToday && "bg-primary font-semibold text-primary-foreground",
                      )}
                    >
                      {Number(day.slice(8, 10))}
                    </div>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map(chip)}
                      {dayTasks.length > 3 ? (
                        <p className="px-1.5 text-[11px] text-muted-foreground">
                          +{dayTasks.length - 3}건
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* List view */
        <div>
          {monthTasks.length === 0 ? (
            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              이 달에 해당하는 신고 마감이 없습니다.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {monthTasks.map((t) => {
                const tone = toneFor(t);
                const d = daysUntil(t.due_date);
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 shrink-0 text-center">
                        <div className="text-xs text-muted-foreground">
                          {Number(t.due_date.slice(5, 7))}월
                        </div>
                        <div className="text-lg font-semibold tabular-nums">
                          {Number(t.due_date.slice(8, 10))}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/clients/${t.client_id}`}
                          className="font-medium hover:underline"
                        >
                          {t.client_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {filingTypeLabel(t.filing_type)} · {t.period_label}
                          {t.assignee_name ? ` · ${t.assignee_name}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {tone === "overdue" ? (
                        <span className="text-xs font-medium text-destructive">기한 경과</span>
                      ) : tone === "imminent" ? (
                        <span className="text-xs font-medium text-amber-600">D-{d}</span>
                      ) : null}
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {FILING_STATUS_LABELS[t.status]}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded bg-amber-200 dark:bg-amber-900" /> 임박(D-{IMMINENT_DAYS})
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded bg-destructive/30" /> 기한 경과
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded bg-muted" /> 완료/신고됨
        </span>
      </div>
    </div>
  );
}
