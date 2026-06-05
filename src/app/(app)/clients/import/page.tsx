import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ImportWizard } from "@/app/(app)/clients/import/_components/import-wizard";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "거래처 일괄 등록" };

export default async function ClientImportPage() {
  const session = await requireSession();
  // Client creation is owner-only (RLS), so the import flow is too.
  if (session.member.role !== "owner") redirect("/clients");

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> 거래처 목록
        </Link>
      </div>
      <PageHeader
        title="거래처 일괄 등록"
        description="엑셀 템플릿으로 여러 거래처를 한 번에 등록합니다."
      />
      <ImportWizard />
    </div>
  );
}
