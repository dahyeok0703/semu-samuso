"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAllNotificationsRead, markNotificationReadAction } from "@/lib/reminders/actions";
import type { NotificationRow } from "@/lib/reminders/queries";
import { cn } from "@/lib/utils";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export function NotificationBell({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read_at).length;

  function openItem(n: NotificationRow) {
    setOpen(false);
    startTransition(async () => {
      if (!n.read_at) await markNotificationReadAction({ id: n.id });
      if (n.link) router.push(n.link);
      else router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="알림">
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">알림</span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              모두 읽음
            </button>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <BellOff className="size-5" />
            <span className="text-sm">새 알림이 없습니다</span>
          </div>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-accent",
                    !n.read_at && "bg-primary/5",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {!n.read_at ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                    {n.title}
                  </span>
                  {n.body ? (
                    <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                  ) : null}
                  <span className="text-[11px] text-muted-foreground">{fmt(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
