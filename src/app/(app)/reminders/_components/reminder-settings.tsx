"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { updateReminderSettingsAction } from "@/lib/reminders/actions";
import { CHANNEL_LABELS } from "@/lib/messaging/labels";

export function ReminderSettings({
  autoSend: initialAuto,
  channels: initialChannels,
  offsets,
  availableChannels,
  canEdit,
}: {
  autoSend: boolean;
  channels: string[];
  offsets: number[];
  availableChannels: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [autoSend, setAutoSend] = useState(initialAuto);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialChannels.filter((c) => availableChannels.includes(c))),
  );

  function toggle(channel: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  }

  function save() {
    if (selected.size === 0) {
      toast.error("채널을 1개 이상 선택해 주세요.");
      return;
    }
    startTransition(async () => {
      const res = await updateReminderSettingsAction({
        auto_send: autoSend,
        channels: Array.from(selected) as ("inapp" | "email" | "kakao" | "sms")[],
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("리마인더 설정을 저장했습니다.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">발송 설정</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-3">
          <Checkbox
            checked={autoSend}
            disabled={!canEdit || isPending}
            onCheckedChange={(c) => setAutoSend(c === true)}
          />
          <span className="text-sm">
            <span className="font-medium">자동 발송</span> — 매일 D-{offsets.join("/D-")} 대상에게
            자동으로 발송합니다. {autoSend ? "" : "끄면 알림(인앱)만 생성됩니다."}
          </span>
        </label>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">채널</p>
          <div className="flex flex-wrap gap-3">
            {["inapp", "email", "kakao", "sms"].map((ch) => {
              const enabled = availableChannels.includes(ch);
              return (
                <label
                  key={ch}
                  className={`flex items-center gap-2 text-sm ${enabled ? "" : "opacity-50"}`}
                >
                  <Checkbox
                    checked={selected.has(ch)}
                    disabled={!canEdit || !enabled || isPending}
                    onCheckedChange={() => toggle(ch)}
                  />
                  {CHANNEL_LABELS[ch]}
                  {!enabled ? (
                    <Badge variant="muted" className="text-[10px]">
                      키 필요
                    </Badge>
                  ) : null}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            카카오 알림톡·SMS는 Solapi 키가 설정되면 활성화됩니다. 미설정 시 자동으로 이메일로
            대체됩니다.
          </p>
        </div>

        {canEdit ? (
          <Button size="sm" onClick={save} disabled={isPending}>
            {isPending ? "저장 중…" : "설정 저장"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">설정 변경은 대표(owner)만 가능합니다.</p>
        )}
      </CardContent>
    </Card>
  );
}
