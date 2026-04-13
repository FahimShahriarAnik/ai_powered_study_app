import { AppSidebar } from "@/components/app-sidebar";
import { TopNav } from "@/components/top-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop only; mobile uses sheet in TopNav */}
        <aside className="hidden w-60 shrink-0 border-r border-border md:block overflow-hidden">
          <AppSidebar />
        </aside>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
