import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <span className="sr-only">불러오는 중…</span>
    </div>
  );
}
