import type { Metadata } from "next";

import { ReminderCandidates } from "@/app/(app)/reminders/_components/reminder-candidates";
import { ReminderSettings } from "@/app/(app)/reminders/_components/reminder-settings";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import { availableChannels } from "@/lib/messaging/channels";
import {
  channelLabel,
  REMINDER_STATUS_BADGE,
  REMINDER_STATUS_LABELS,
} from "@/lib/messaging/labels";
import {
  getReminderSettings,
  listRecentReminders,
  listReminderCandidates,
} from "@/lib/reminders/queries";

export const metadata: Metadata = { title: "리마인더" };

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export default async function RemindersPage() {
  const session = await requireSession();
  const isOwner = session.member.role === "owner";

  const settings = await getReminderSettings();
  const [candidates, history] = await Promise.all([
    listReminderCandidates(settings.offsets),
    listRecentReminders(80),
  ]);
  const available = availableChannels();

  return (
    <div className="space-y-6">
      <PageHeader
        title="리마인더"
        description="마감이 가까운데 자료가 미제출인 거래처에 독촉/알림을 보냅니다."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ReminderSettings
            autoSend={settings.auto_send}
            channels={settings.channels}
            offsets={settings.offsets}
            availableChannels={available}
            canEdit={isOwner}
          />
        </div>

        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            독촉 대상 ({candidates.length})
          </h2>
          <ReminderCandidates
            candidates={candidates}
            availableChannels={available}
            defaultChannels={settings.channels}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 발송 이력</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {history.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">아직 발송 이력이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>거래처</TableHead>
                  <TableHead>채널</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="hidden md:table-cell">비고</TableHead>
                  <TableHead className="text-right">시각</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.client_name}</TableCell>
                    <TableCell>{channelLabel(r.channel)}</TableCell>
                    <TableCell>
                      <Badge variant={REMINDER_STATUS_BADGE[r.status] ?? "muted"}>
                        {REMINDER_STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-[280px] truncate text-xs text-muted-foreground md:table-cell">
                      {r.response_note ?? r.error ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {fmt(r.sent_at ?? r.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
