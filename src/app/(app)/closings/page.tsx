import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "마감" };

export default function ClosingsPage() {
  return (
    <div>
      <PageHeader title="마감" description="기장 및 결산 마감을 관리합니다." />
      <EmptyState
        icon={CalendarCheck}
        title="마감 항목이 없습니다"
        description="월별·분기별 마감 진행 상황을 이곳에서 추적할 예정입니다."
      />
    </div>
  );
}
