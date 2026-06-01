"use client";

import { useEffect } from "react";

/**
 * Top-level error boundary. Catches errors thrown in the root layout itself.
 * Must render its own <html>/<body> because it replaces the root layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-semibold">문제가 발생했습니다</h1>
          <p className="text-sm text-muted-foreground">
            예상치 못한 오류로 페이지를 표시할 수 없습니다. 잠시 후 다시 시도해 주세요.
          </p>
          {error.digest ? (
            <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              오류 코드: {error.digest}
            </code>
          ) : null}
          <button
            onClick={reset}
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
