import { redirect } from "next/navigation";

import { Brand } from "@/components/app-shell/brand";
import { getSession } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Already signed in? Skip the auth screens.
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-6 flex justify-center">
        <Brand />
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        세무사무소 내부 업무 관리 시스템
      </p>
    </div>
  );
}
