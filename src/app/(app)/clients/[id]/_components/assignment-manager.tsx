"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setClientAssignmentsAction } from "@/lib/clients/actions";
import type { WorkspaceMember } from "@/lib/clients/queries";

export function AssignmentManager({
  clientId,
  members,
  assigneeIds,
  canEdit,
}: {
  clientId: string;
  members: WorkspaceMember[];
  assigneeIds: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(assigneeIds));
  const [isPending, startTransition] = useTransition();

  const current = members.filter((m) => assigneeIds.includes(m.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const res = await setClientAssignmentsAction({
        clientId,
        memberIds: Array.from(selected),
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("담당자를 변경했습니다.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {current.length === 0 ? (
          <span className="text-sm text-muted-foreground">배정된 담당자가 없습니다.</span>
        ) : (
          current.map((m) => (
            <Badge key={m.id} variant="secondary" className="gap-1">
              <Users className="size-3" />
              {m.name}
              {m.role === "owner" ? " (대표)" : ""}
            </Badge>
          ))
        )}
      </div>

      {canEdit ? (
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) setSelected(new Set(assigneeIds));
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <UserPlus className="size-4" /> 담당자 변경
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>담당자 배정</DialogTitle>
              <DialogDescription>
                이 거래처를 담당할 직원을 선택하세요. 여러 명을 배정할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {members.map((m) => {
                const checked = selected.has(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(m.id)} />
                    <span className="text-sm">
                      {m.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {m.role === "owner" ? "대표" : "직원"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                취소
              </Button>
              <Button onClick={save} disabled={isPending}>
                {isPending ? "저장 중…" : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
