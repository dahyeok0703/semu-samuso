import { MobileNav } from "@/components/app-shell/mobile-nav";
import { NotificationBell } from "@/components/app-shell/notification-bell";
import { UserMenu } from "@/components/app-shell/user-menu";
import type { NotificationRow } from "@/lib/reminders/queries";

export function AppHeader({
  workspaceName,
  displayName,
  email,
  role,
  notifications,
}: {
  workspaceName: string;
  displayName: string;
  email: string | null;
  role: string;
  notifications: NotificationRow[];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <MobileNav workspaceName={workspaceName} />
      <div className="flex flex-1 items-center">
        <span className="text-sm font-medium text-muted-foreground md:hidden">{workspaceName}</span>
      </div>
      <NotificationBell notifications={notifications} />
      <UserMenu displayName={displayName} email={email} role={role} />
    </header>
  );
}
