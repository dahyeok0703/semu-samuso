"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

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
import { CLIENT_STATUS_OPTIONS, TAX_TYPE_OPTIONS } from "@/lib/clients/constants";
import type { WorkspaceMember } from "@/lib/clients/queries";

const ALL = "all";

const SORT_OPTIONS = [
  { value: "created_at:desc", label: "최근 등록순" },
  { value: "created_at:asc", label: "오래된순" },
  { value: "biz_name:asc", label: "상호 (가나다)" },
  { value: "biz_name:desc", label: "상호 (역순)" },
  { value: "status:asc", label: "상태순" },
];

export function ClientsFilters({ members }: { members: WorkspaceMember[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback(
    (next: URLSearchParams) => {
      next.delete("page"); // any filter change resets to page 1
      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [pathname, router],
  );

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "" || value === ALL) next.delete(key);
    else next.set(key, value);
    commit(next);
  }

  // Debounced search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) setParam("q", q);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const sortValue = `${params.get("sort") ?? "created_at"}:${params.get("dir") ?? "desc"}`;
  const hasFilters = ["q", "tax_type", "status", "assigned"].some((k) => params.get(k));

  function clearAll() {
    setQ("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="상호 · 사업자번호 · 대표자 검색"
          aria-label="거래처 검색"
          className="pl-9"
        />
        {isPending ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">과세유형</Label>
          <Select
            value={params.get("tax_type") ?? ALL}
            onValueChange={(v) => setParam("tax_type", v)}
          >
            <SelectTrigger className="w-[140px]" aria-label="과세유형 필터">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체 유형</SelectItem>
              {TAX_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">담당</Label>
          <Select value={params.get("assigned") ?? ALL} onValueChange={(v) => setParam("assigned", v)}>
            <SelectTrigger className="w-[150px]" aria-label="담당자 필터">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체 담당</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  {m.role === "owner" ? " (대표)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">상태</Label>
          <Select value={params.get("status") ?? ALL} onValueChange={(v) => setParam("status", v)}>
            <SelectTrigger className="w-[120px]" aria-label="상태 필터">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체 상태</SelectItem>
              {CLIENT_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">정렬</Label>
          <Select
            value={sortValue}
            onValueChange={(v) => {
              const [sort, dir] = v.split(":");
              const next = new URLSearchParams(params.toString());
              next.set("sort", sort ?? "created_at");
              next.set("dir", dir ?? "desc");
              commit(next);
            }}
          >
            <SelectTrigger className="w-[150px]" aria-label="정렬">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
            <X className="size-4" /> 필터 초기화
          </Button>
        ) : null}
      </div>
    </div>
  );
}
