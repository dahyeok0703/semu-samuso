import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "신고" };

export default function FilingsPage() {
  return (
    <div>
      <PageHeader title="신고" description="부가가치세·종합소득세 등 세무 신고를 관리합니다." />
      <EmptyState
        icon={FileText}
        title="신고 내역이 없습니다"
        description="거래처별 신고 일정과 진행 상태를 이곳에서 관리할 예정입니다."
      />
    </div>
  );
}
