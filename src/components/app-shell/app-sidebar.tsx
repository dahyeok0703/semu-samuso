import { Brand } from "@/components/app-shell/brand";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";

export function AppSidebar({ workspaceName }: { workspaceName: string }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center border-b px-4">
        <Brand workspaceName={workspaceName} />
      </div>
      <SidebarNav />
    </aside>
  );
}
