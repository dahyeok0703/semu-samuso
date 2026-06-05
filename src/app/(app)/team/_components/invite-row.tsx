"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { resendInviteAction, revokeInviteAction } from "@/lib/team/actions";
import type { PendingInvite } from "@/lib/team/queries";

export function InviteRow({ invite }: { invite: PendingInvite }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function resend() {
    startTransition(async () => {
      const res = await resendInviteAction({ id: invite.id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      if (res.data.emailSent && !res.data.note) toast.success("초대를 재발송했습니다.");
      else {
        void navigator.clipboard?.writeText(res.data.inviteLink);
        toast.info("초대 링크를 복사했습니다 (SMTP 미설정).");
      }
      router.refresh();
    });
  }

  function revoke() {
    startTransition(async () => {
      const res = await revokeInviteAction({ id: invite.id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("초대를 취소했습니다.");
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-muted-foreground" />
        <span className="text-sm">{invite.email}</span>
        <span className="text-xs text-muted-foreground">
          만료 {new Date(invite.expiresAt).toLocaleDateString("ko-KR")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={resend} disabled={isPending}>
          <Copy className="size-3.5" /> 재발송
        </Button>
        <Button variant="ghost" size="sm" onClick={revoke} disabled={isPending} className="text-destructive">
          취소
        </Button>
      </div>
    </li>
  );
}
