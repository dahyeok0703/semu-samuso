"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="size-8 text-destructive" />
      <h2 className="text-lg font-semibold">화면을 불러오지 못했습니다</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        일시적인 오류일 수 있습니다. 다시 시도하거나 잠시 후 접속해 주세요.
      </p>
      {error.digest ? (
        <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          {error.digest}
        </code>
      ) : null}
      <Button onClick={reset} className="mt-2">
        다시 시도
      </Button>
    </div>
  );
}
