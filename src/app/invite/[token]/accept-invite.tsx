"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptInviteAction } from "@/lib/team/actions";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      const res = await acceptInviteAction({ token });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("초대를 수락했습니다. 사무소에 합류했습니다.");
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <Button className="w-full" onClick={accept} disabled={isPending}>
      {isPending ? "수락 중…" : "초대 수락하고 합류"}
    </Button>
  );
}
