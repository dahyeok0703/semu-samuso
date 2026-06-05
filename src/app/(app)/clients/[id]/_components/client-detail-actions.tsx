"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClientFormSheet } from "@/app/(app)/clients/_components/client-form-sheet";
import { deleteClientAction, updateClientStatusAction } from "@/lib/clients/actions";
import { CLIENT_STATUS_LABELS } from "@/lib/clients/constants";
import type { Client, ClientStatus } from "@/types/database.types";

export function ClientDetailActions({
  client,
  isOwner,
  canEdit,
}: {
  client: Client;
  isOwner: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"end" | "delete" | null>(null);

  function changeStatus(status: ClientStatus) {
    startTransition(async () => {
      const res = await updateClientStatusAction({ id: client.id, status });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`상태를 '${CLIENT_STATUS_LABELS[status]}'(으)로 변경했습니다.`);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteClientAction({ id: client.id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("거래처를 삭제했습니다.");
      router.push("/clients");
    });
  }

  return (
    <div className="flex items-center gap-2">
      {canEdit ? (
        <ClientFormSheet
          client={client}
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> 수정
            </Button>
          }
        />
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="추가 작업" disabled={isPending}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>상태 변경</DropdownMenuLabel>
          <DropdownMenuItem disabled={client.status === "active"} onSelect={() => changeStatus("active")}>
            정상으로
          </DropdownMenuItem>
          <DropdownMenuItem disabled={client.status === "paused"} onSelect={() => changeStatus("paused")}>
            중단으로
          </DropdownMenuItem>
          <DropdownMenuItem disabled={client.status === "ended"} onSelect={() => setConfirm("end")}>
            해지 처리
          </DropdownMenuItem>
          {isOwner ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirm("delete")}
              >
                <Trash2 className="size-4" /> 영구 삭제
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete" ? "거래처를 영구 삭제할까요?" : "거래처를 해지 처리할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? `'${client.biz_name}'의 모든 데이터가 영구 삭제됩니다. 되돌릴 수 없습니다.`
                : `'${client.biz_name}'의 상태를 ‘해지’로 변경합니다. 데이터는 보존됩니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === "delete") remove();
                else changeStatus("ended");
                setConfirm(null);
              }}
              className={
                confirm === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {confirm === "delete" ? "영구 삭제" : "해지 처리"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
