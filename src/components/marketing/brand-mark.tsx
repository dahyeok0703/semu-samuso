import Link from "next/link";
import { Calculator } from "lucide-react";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";

/** Product wordmark used across the public marketing site. Links to home. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2.5", className)}
      aria-label={siteConfig.name}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Calculator className="size-4" />
      </span>
      <span className="text-base font-semibold tracking-tight">{siteConfig.name}</span>
    </Link>
  );
}
