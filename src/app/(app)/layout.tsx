import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { requireSession } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Redirects to /login when unauthenticated (defence-in-depth alongside middleware).
  const session = await requireSession();

  return (
    <div className="flex min-h-dvh bg-background">
      <AppSidebar workspaceName={session.workspace.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          workspaceName={session.workspace.name}
          displayName={session.member.display_name}
          email={session.email}
          role={session.member.role}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
