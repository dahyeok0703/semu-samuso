import { Calculator } from "lucide-react";

import { cn } from "@/lib/utils";

export function Brand({
  workspaceName,
  className,
}: {
  workspaceName?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Calculator className="size-4" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">세무사무소</span>
        {workspaceName ? (
          <span className="truncate text-xs text-muted-foreground">{workspaceName}</span>
        ) : null}
      </div>
    </div>
  );
}
