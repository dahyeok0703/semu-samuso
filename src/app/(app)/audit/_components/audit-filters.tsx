"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUDIT_ACTION_OPTIONS } from "@/lib/audit/labels";
import type { WorkspaceMember } from "@/lib/clients/queries";

const ALL = "all";

export function AuditFilters({ members }: { members: WorkspaceMember[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    if (value === null || value === "" || value === ALL) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const hasFilters = ["member", "action", "from", "to"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">직원</Label>
        <Select value={params.get("member") ?? ALL} onValueChange={(v) => setParam("member", v)}>
          <SelectTrigger className="w-[150px]" aria-label="직원 필터">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체 직원</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">액션</Label>
        <Select value={params.get("action") ?? ALL} onValueChange={(v) => setParam("action", v)}>
          <SelectTrigger className="w-[170px]" aria-label="액션 필터">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={ALL}>전체 액션</SelectItem>
            {AUDIT_ACTION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">시작일</Label>
        <Input
          type="date"
          value={params.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
          className="w-[150px]"
          aria-label="시작일"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">종료일</Label>
        <Input
          type="date"
          value={params.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
          className="w-[150px]"
          aria-label="종료일"
        />
      </div>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="text-muted-foreground"
        >
          <X className="size-4" /> 초기화
        </Button>
      ) : null}
    </div>
  );
}
