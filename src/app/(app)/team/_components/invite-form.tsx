"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteMemberAction } from "@/lib/team/actions";

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      const res = await inviteMemberAction({ email });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setEmail("");
      setLink(res.data.inviteLink);
      if (res.data.emailSent && !res.data.note) {
        toast.success("초대 이메일을 보냈습니다.");
      } else {
        toast.info("초대를 생성했습니다. 이메일이 비활성(SMTP 미설정)이면 아래 링크를 전달하세요.");
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="직원 이메일"
          aria-label="초대할 직원 이메일"
        />
        <Button type="submit" disabled={isPending}>
          <UserPlus className="size-4" /> {isPending ? "초대 중…" : "초대"}
        </Button>
      </form>

      {link ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs">
          <code className="min-w-0 flex-1 truncate">{link}</code>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              toast.success("초대 링크를 복사했습니다.");
            }}
          >
            <Copy className="size-3.5" /> 복사
          </Button>
        </div>
      ) : null}
    </div>
  );
}
