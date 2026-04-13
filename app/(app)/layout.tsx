import { AppSidebar } from "@/components/app-sidebar";
import { TopNav } from "@/components/top-nav";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/types/database";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [{ data: { user } }, { data: courses }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("courses").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav user={user} courses={(courses ?? []) as Course[]} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-60 shrink-0 border-r border-border md:block overflow-hidden">
          <AppSidebar courses={(courses ?? []) as Course[]} />
        </aside>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
