import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { BillingBanner } from "@/components/app-shell/billing-banner";
import { requireSession } from "@/lib/auth/session";
import { getMyNotifications } from "@/lib/reminders/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Redirects to /login when unauthenticated (defence-in-depth alongside middleware).
  const session = await requireSession();
  const notifications = await getMyNotifications();

  return (
    <div className="flex min-h-dvh bg-background">
      <AppSidebar workspaceName={session.workspace.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          workspaceName={session.workspace.name}
          displayName={session.member.name}
          email={session.email}
          role={session.member.role}
          notifications={notifications}
        />
        <BillingBanner
          isOwner={session.member.role === "owner"}
          state={{
            plan: session.workspace.plan,
            subscription_status: session.workspace.subscription_status,
            trial_ends_at: session.workspace.trial_ends_at,
            current_period_end: session.workspace.current_period_end,
            grace_until: session.workspace.grace_until,
          }}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
