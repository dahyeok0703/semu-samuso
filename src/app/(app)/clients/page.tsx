import type { Metadata } from "next";
import { Building2 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "거래처" };

export default function ClientsPage() {
  return (
    <div>
      <PageHeader
        title="거래처"
        description="수임 중인 거래처를 관리합니다."
        actions={<Button disabled>거래처 추가</Button>}
      />
      <EmptyState
        icon={Building2}
        title="아직 등록된 거래처가 없습니다"
        description="거래처(상호·사업자번호·과세유형)를 등록하면 이곳에 목록이 표시됩니다. 기능은 곧 추가될 예정입니다."
      />
    </div>
  );
}
