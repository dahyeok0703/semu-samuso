import type { Metadata } from "next";
import { FileSignature } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "수임" };

export default function EngagementsPage() {
  return (
    <div>
      <PageHeader title="수임" description="거래처 수임 계약을 관리합니다." />
      <EmptyState
        icon={FileSignature}
        title="수임 계약이 없습니다"
        description="수임 시작일·수수료·계약 상태 등을 이곳에서 관리할 예정입니다."
      />
    </div>
  );
}
