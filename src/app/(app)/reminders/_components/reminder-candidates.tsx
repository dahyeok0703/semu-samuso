"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CHANNEL_LABELS } from "@/lib/messaging/labels";
import { sendRemindersAction } from "@/lib/reminders/actions";
import type { ReminderCandidate } from "@/lib/reminders/queries";

type SendChannel = "inapp" | "email" | "kakao" | "sms";

export function ReminderCandidates({
  candidates,
  availableChannels,
  defaultChannels,
}: {
  candidates: ReminderCandidate[];
  availableChannels: string[];
  defaultChannels: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [channels, setChannels] = useState<Set<string>>(
    new Set(defaultChannels.filter((c) => availableChannels.includes(c))),
  );

  const allSelected = candidates.length > 0 && selectedTasks.size === candidates.length;

  function toggleTask(id: string) {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelectedTasks(allSelected ? new Set() : new Set(candidates.map((c) => c.taskId)));
  }
  function toggleChannel(ch: string) {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }

  const channelList = useMemo(() => Array.from(channels) as SendChannel[], [channels]);

  function send(taskIds: string[]) {
    if (taskIds.length === 0) {
      toast.error("보낼 대상을 선택해 주세요.");
      return;
    }
    if (channelList.length === 0) {
      toast.error("채널을 1개 이상 선택해 주세요.");
      return;
    }
    startTransition(async () => {
      const res = await sendRemindersAction({ taskIds, channels: channelList });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      const { sent, failed, skipped } = res.data;
      toast.success(
        `발송 완료 — 성공 ${sent}건${failed ? `, 실패 ${failed}건` : ""}${skipped ? `, 건너뜀 ${skipped}건` : ""}`,
      );
      setSelectedTasks(new Set());
      router.refresh();
    });
  }

  if (candidates.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="독촉 대상이 없습니다"
        description="마감이 가까운 거래처 중 자료가 미제출인 건이 여기에 표시됩니다."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">채널:</span>
          {["inapp", "email", "kakao", "sms"].map((ch) => {
            const enabled = availableChannels.includes(ch);
            return (
              <label
                key={ch}
                className={`flex items-center gap-1.5 text-sm ${enabled ? "" : "opacity-50"}`}
              >
                <Checkbox
                  checked={channels.has(ch)}
                  disabled={!enabled || isPending}
                  onCheckedChange={() => toggleChannel(ch)}
                />
                {CHANNEL_LABELS[ch]}
              </label>
            );
          })}
        </div>
        <Button
          size="sm"
          onClick={() => send(Array.from(selectedTasks))}
          disabled={isPending || selectedTasks.size === 0}
        >
          <Send className="size-4" /> 선택 {selectedTasks.size}건 발송
        </Button>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="전체 선택" />
              </TableHead>
              <TableHead>거래처</TableHead>
              <TableHead className="hidden md:table-cell">신고</TableHead>
              <TableHead>마감</TableHead>
              <TableHead className="hidden lg:table-cell">미제출 자료</TableHead>
              <TableHead className="w-[1%] text-right">발송</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((c) => (
              <TableRow key={c.taskId}>
                <TableCell>
                  <Checkbox
                    checked={selectedTasks.has(c.taskId)}
                    onCheckedChange={() => toggleTask(c.taskId)}
                    aria-label={`${c.clientName} 선택`}
                  />
                </TableCell>
                <TableCell>
                  <Link href={`/clients/${c.clientId}`} className="font-medium hover:underline">
                    {c.clientName}
                  </Link>
                  <div className="text-xs text-muted-foreground md:hidden">{c.filingLabel}</div>
                  {!c.contactEmail && !c.contactPhone ? (
                    <div className="text-xs text-amber-600">연락처 없음</div>
                  ) : null}
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">{c.filingLabel}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm tabular-nums">D-{c.daysLeft}</span>
                    {c.matchedOffset !== null ? <Badge variant="warning">오늘 대상</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {c.missingDocs.length > 0 ? (
                    <span className="text-sm text-muted-foreground">
                      {c.missingDocs.slice(0, 2).join(", ")}
                      {c.missingDocs.length > 2 ? ` 외 ${c.missingDocs.length - 2}건` : ""}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">확인 필요</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => send([c.taskId])}
                    disabled={isPending}
                  >
                    발송
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
