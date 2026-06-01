import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-5xl font-bold text-muted-foreground">404</p>
        <h1 className="text-xl font-semibold">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-muted-foreground">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <Button asChild className="mt-2">
          <Link href="/dashboard">대시보드로 이동</Link>
        </Button>
      </div>
    </div>
  );
}
