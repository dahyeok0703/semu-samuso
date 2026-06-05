"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateMemberRoleAction, updateMemberStatusAction } from "@/lib/team/actions";
import type { TeamMember } from "@/lib/team/queries";

export function MemberRow({ member, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function changeRole(role: "owner" | "staff") {
    if (role === member.role) return;
    startTransition(async () => {
      const res = await updateMemberRoleAction({ memberId: member.id, role });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("역할을 변경했습니다.");
      router.refresh();
    });
  }

  function toggleStatus() {
    const next = member.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      const res = await updateMemberStatusAction({ memberId: member.id, status: next });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(next === "active" ? "활성화했습니다." : "비활성화했습니다.");
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-3">
        <Avatar className="size-8">
          <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {member.name}
            {isSelf ? (
              <Badge variant="outline" className="text-[10px]">
                나
              </Badge>
            ) : null}
          </p>
          {member.status === "inactive" ? (
            <Badge variant="muted" className="text-[10px]">
              비활성
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={member.role} onValueChange={(v) => changeRole(v as "owner" | "staff")} disabled={isPending}>
          <SelectTrigger className="h-8 w-[110px]" aria-label={`${member.name} 역할`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="owner">대표</SelectItem>
            <SelectItem value="staff">직원</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={toggleStatus} disabled={isPending || isSelf}>
          {member.status === "active" ? "비활성화" : "활성화"}
        </Button>
      </div>
    </li>
  );
}
