"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteClientAction, updateClientStatusAction } from "@/lib/clients/actions";
import { formatBizRegNo } from "@/lib/clients/biz-reg-no";
import {
  CLIENT_STATUS_BADGE,
  CLIENT_STATUS_LABELS,
  TAX_TYPE_LABELS,
} from "@/lib/clients/constants";
import { ClientFormSheet } from "@/app/(app)/clients/_components/client-form-sheet";
import type { ClientWithAssignees } from "@/lib/clients/queries";
import type { ClientStatus } from "@/types/database.types";

type OptimisticOp =
  | { type: "status"; id: string; status: ClientStatus }
  | { type: "remove"; id: string };

function reducer(state: ClientWithAssignees[], op: OptimisticOp): ClientWithAssignees[] {
  if (op.type === "remove") return state.filter((c) => c.id !== op.id);
  return state.map((c) => (c.id === op.id ? { ...c, status: op.status } : c));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function ClientsTable({
  rows,
  isOwner,
}: {
  rows: ClientWithAssignees[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [optimisticRows, applyOptimistic] = useOptimistic(rows, reducer);
  const [, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<
    { type: "end" | "delete"; client: ClientWithAssignees } | null
  >(null);

  function changeStatus(client: ClientWithAssignees, status: ClientStatus) {
    startTransition(async () => {
      applyOptimistic({ type: "status", id: client.id, status });
      const res = await updateClientStatusAction({ id: client.id, status });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`'${client.biz_name}' 상태를 '${CLIENT_STATUS_LABELS[status]}'(으)로 변경했습니다.`);
      router.refresh();
    });
  }

  function removeClient(client: ClientWithAssignees) {
    startTransition(async () => {
      applyOptimistic({ type: "remove", id: client.id });
      const res = await deleteClientAction({ id: client.id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`'${client.biz_name}'을(를) 삭제했습니다.`);
      router.refresh();
    });
  }

  function confirmProceed() {
    if (!confirm) return;
    if (confirm.type === "end") changeStatus(confirm.client, "ended");
    else removeClient(confirm.client);
    setConfirm(null);
  }

  return (
    <>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>상호</TableHead>
              <TableHead className="hidden md:table-cell">사업자번호</TableHead>
              <TableHead className="hidden lg:table-cell">과세유형</TableHead>
              <TableHead className="hidden lg:table-cell">담당</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="hidden xl:table-cell">등록일</TableHead>
              <TableHead className="w-[1%] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimisticRows.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-medium hover:underline focus:underline focus:outline-none"
                  >
                    {client.biz_name}
                  </Link>
                  {client.ceo_name ? (
                    <span className="ml-2 text-xs text-muted-foreground">{client.ceo_name}</span>
                  ) : null}
                  <div className="mt-0.5 text-xs text-muted-foreground md:hidden">
                    {client.biz_reg_no ? formatBizRegNo(client.biz_reg_no) : "사업자번호 미등록"}
                  </div>
                </TableCell>
                <TableCell className="hidden font-mono text-xs md:table-cell">
                  {client.biz_reg_no ? formatBizRegNo(client.biz_reg_no) : "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {client.tax_type ? (
                    <Badge variant="outline">{TAX_TYPE_LABELS[client.tax_type]}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {client.assignees.length === 0 ? (
                    <span className="text-muted-foreground">미배정</span>
                  ) : (
                    <span className="text-sm">
                      {client.assignees.map((a) => a.name).join(", ")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={CLIENT_STATUS_BADGE[client.status]}>
                    {CLIENT_STATUS_LABELS[client.status]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                  {formatDate(client.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <ClientFormSheet
                      client={client}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`${client.biz_name} 수정`}>
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${client.biz_name} 추가 작업`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>상태 변경</DropdownMenuLabel>
                        <DropdownMenuItem
                          disabled={client.status === "active"}
                          onSelect={() => changeStatus(client, "active")}
                        >
                          정상으로
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={client.status === "paused"}
                          onSelect={() => changeStatus(client, "paused")}
                        >
                          중단으로
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={client.status === "ended"}
                          onSelect={() => setConfirm({ type: "end", client })}
                        >
                          해지 처리
                        </DropdownMenuItem>
                        {isOwner ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setConfirm({ type: "delete", client })}
                            >
                              <Trash2 className="size-4" /> 영구 삭제
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === "delete" ? "거래처를 영구 삭제할까요?" : "거래처를 해지 처리할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "delete" ? (
                <>
                  <span className="font-medium text-foreground">{confirm?.client.biz_name}</span>
                  의 모든 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 가능하면 ‘해지
                  처리’(상태 변경)를 사용하세요.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{confirm?.client.biz_name}</span>
                  의 상태를 ‘해지’로 변경합니다. 데이터는 보존되며 언제든 다시 정상으로 되돌릴 수
                  있습니다.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmProceed}
              className={
                confirm?.type === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {confirm?.type === "delete" ? "영구 삭제" : "해지 처리"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
