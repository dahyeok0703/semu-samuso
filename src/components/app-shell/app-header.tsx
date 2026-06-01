import { MobileNav } from "@/components/app-shell/mobile-nav";
import { UserMenu } from "@/components/app-shell/user-menu";

export function AppHeader({
  workspaceName,
  displayName,
  email,
  role,
}: {
  workspaceName: string;
  displayName: string;
  email: string | null;
  role: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <MobileNav workspaceName={workspaceName} />
      <div className="flex flex-1 items-center">
        <span className="text-sm font-medium text-muted-foreground md:hidden">
          {workspaceName}
        </span>
      </div>
      <UserMenu displayName={displayName} email={email} role={role} />
    </header>
  );
}
