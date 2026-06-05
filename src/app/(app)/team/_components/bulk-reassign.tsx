"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkspaceMember } from "@/lib/clients/queries";
import { bulkReassignAction } from "@/lib/team/actions";
import type { ClientAssignmentRow } from "@/lib/team/queries";

const NONE = "none";
type Mode = "replace" | "add" | "remove";

export function BulkReassign({
  clients,
  members,
}: {
  clients: ClientAssignmentRow[];
  members: WorkspaceMember[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [memberId, setMemberId] = useState<string>(NONE);
  const [mode, setMode] = useState<Mode>("replace");

  const memberName = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const filtered = useMemo(
    () => clients.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [clients, query],
  );
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.clientId));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((c) => next.delete(c.clientId));
      else filtered.forEach((c) => next.add(c.clientId));
      return next;
    });
  }

  function apply() {
    if (selected.size === 0) {
      toast.error("거래처를 선택해 주세요.");
      return;
    }
    if (mode !== "replace" && memberId === NONE) {
      toast.error("담당자를 선택해 주세요.");
      return;
    }
    startTransition(async () => {
      const res = await bulkReassignAction({
        clientIds: Array.from(selected),
        memberId: memberId === NONE ? null : memberId,
        mode,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`${res.data.count}개 거래처를 재배정했습니다.`);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">방식</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SelectTrigger className="w-[160px]" aria-label="재배정 방식">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="replace">교체 (기존 담당 삭제)</SelectItem>
              <SelectItem value="add">추가</SelectItem>
              <SelectItem value="remove">제거</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">담당자</Label>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger className="w-[160px]" aria-label="대상 담당자">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mode === "replace" ? <SelectItem value={NONE}>미배정 (담당 해제)</SelectItem> : null}
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  {m.role === "owner" ? " (대표)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={apply} disabled={isPending || selected.size === 0}>
          {isPending ? "처리 중…" : `선택 ${selected.size}개 적용`}
        </Button>
      </div>

      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="거래처 검색"
        aria-label="거래처 검색"
      />

      <div className="rounded-xl border">
        <label className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
          <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} aria-label="전체 선택" />
          전체 선택 ({filtered.length})
        </label>
        <ul className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="p-4 text-center text-sm text-muted-foreground">거래처가 없습니다.</li>
          ) : (
            filtered.map((c) => (
              <li key={c.clientId}>
                <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-accent">
                  <span className="flex items-center gap-2">
                    <Checkbox
                      checked={selected.has(c.clientId)}
                      onCheckedChange={() => toggle(c.clientId)}
                    />
                    <span className="text-sm">{c.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c.assigneeIds.length === 0
                      ? "미배정"
                      : c.assigneeIds.map((id) => memberName.get(id) ?? "?").join(", ")}
                  </span>
                </label>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
