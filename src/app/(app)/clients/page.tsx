import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FileSpreadsheet, Plus, SearchX } from "lucide-react";

import { ClientFormSheet } from "@/app/(app)/clients/_components/client-form-sheet";
import { ErpImportButton } from "@/app/(app)/clients/_components/erp-import-button";
import { ClientsFilters } from "@/app/(app)/clients/_components/clients-filters";
import { ClientsPagination } from "@/app/(app)/clients/_components/clients-pagination";
import { ClientsTable } from "@/app/(app)/clients/_components/clients-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { resolveErpImport } from "@/lib/integrations/settings";
import { listClients, listWorkspaceMembers } from "@/lib/clients/queries";
import { clientListParamsSchema } from "@/lib/clients/schemas";

export const metadata: Metadata = { title: "거래처" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const isOwner = session.member.role === "owner";
  const erpImportAvailable = isOwner
    ? (await resolveErpImport(session.workspace.id)).available
    : false;

  const raw = await searchParams;
  const params = clientListParamsSchema.parse(raw);

  const [members, result] = await Promise.all([listWorkspaceMembers(), listClients(params)]);

  const hasAnyFilter = Boolean(params.q || params.tax_type || params.status || params.assigned);

  return (
    <div className="space-y-5">
      <PageHeader
        title="거래처"
        description="수임 중인 거래처를 관리합니다."
        actions={
          isOwner ? (
            <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                <Link href="/clients/import">
                  <FileSpreadsheet className="size-4" /> 엑셀 일괄 등록
                </Link>
              </Button>
              {erpImportAvailable ? <ErpImportButton /> : null}
              <ClientFormSheet
                trigger={
                  <Button>
                    <Plus className="size-4" /> 거래처 추가
                  </Button>
                }
              />
            </div>
          ) : null
        }
      />

      <ClientsFilters members={members} />

      {result.rows.length === 0 ? (
        hasAnyFilter ? (
          <EmptyState
            icon={SearchX}
            title="검색 결과가 없습니다"
            description="검색어나 필터 조건을 변경해 보세요."
          />
        ) : (
          <EmptyState
            icon={Building2}
            title="아직 등록된 거래처가 없습니다"
            description="거래처를 등록하면 이곳에 목록이 표시됩니다."
            action={
              isOwner ? (
                <ClientFormSheet
                  trigger={
                    <Button>
                      <Plus className="size-4" /> 첫 거래처 등록
                    </Button>
                  }
                />
              ) : undefined
            }
          />
        )
      ) : (
        <div className="space-y-4">
          <ClientsTable rows={result.rows} isOwner={isOwner} />
          <ClientsPagination page={result.page} pageCount={result.pageCount} total={result.total} />
        </div>
      )}
    </div>
  );
}
