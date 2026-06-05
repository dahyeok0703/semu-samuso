import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";

import { AuditFilters } from "@/app/(app)/audit/_components/audit-filters";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import { auditActionLabel } from "@/lib/audit/labels";
import { auditParamsSchema, listAuditLogs } from "@/lib/audit/queries";
import { listWorkspaceMembers } from "@/lib/clients/queries";

export const metadata: Metadata = { title: "감사 로그" };

function metaSummary(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const entries = Object.entries(meta as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .slice(0, 3)
    .map(([k, v]) => `${k}=${String(v)}`);
  return entries.join(", ");
}

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const qs = next.toString();
  return qs ? `/audit?${qs}` : "/audit";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  if (session.member.role !== "owner") redirect("/dashboard");

  const raw = await searchParams;
  const params = auditParamsSchema.parse(raw);
  const [result, members] = await Promise.all([listAuditLogs(params), listWorkspaceMembers()]);

  const urlParams = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") urlParams.set(k, v);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="감사 로그" description="워크스페이스의 모든 변경 이력입니다." />

      <AuditFilters members={members} />

      {result.entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="기록이 없습니다"
          description="조건에 맞는 감사 로그가 없습니다. 필터를 변경해 보세요."
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>시각</TableHead>
                  <TableHead>직원</TableHead>
                  <TableHead>액션</TableHead>
                  <TableHead className="hidden md:table-cell">대상/상세</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString("ko-KR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-sm">{e.actorName}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {auditActionLabel(e.action)}
                    </TableCell>
                    <TableCell className="hidden max-w-[360px] truncate text-xs text-muted-foreground md:table-cell">
                      {[e.targetTable, metaSummary(e.meta)].filter(Boolean).join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              총 {result.total}건 · {result.page}/{result.pageCount} 페이지
            </p>
            <div className="flex items-center gap-2">
              {result.page <= 1 ? (
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft className="size-4" /> 이전
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(urlParams, result.page - 1)}>
                    <ChevronLeft className="size-4" /> 이전
                  </Link>
                </Button>
              )}
              {result.page >= result.pageCount ? (
                <Button variant="outline" size="sm" disabled>
                  다음 <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(urlParams, result.page + 1)}>
                    다음 <ChevronRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
