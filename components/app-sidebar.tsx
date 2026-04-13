"use client";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import type { Course } from "@/types/database";
import { cn } from "@/lib/utils";
import { BookOpen, LayoutDashboard, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setCourses(data ?? []);
        setLoading(false);
      });
  }, [pathname]); // re-fetch when route changes (e.g. after adding a course)

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="hidden h-14 items-center border-b border-border px-4 md:flex">
        <span className="font-semibold tracking-tight text-foreground">
          Cortex
        </span>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="mb-4 space-y-1">
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({
                variant: pathname === "/dashboard" ? "secondary" : "ghost",
              }),
              "w-full justify-start gap-2 text-sm"
            )}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Dashboard
          </Link>
        </nav>

        <Separator className="my-2" />

        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Courses
            </span>
            <Link
              href="/dashboard?new=1"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-xs" }),
                "text-muted-foreground hover:text-foreground"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only">New course</span>
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : courses.length === 0 ? (
            <p className="px-1 py-3 text-xs text-muted-foreground">
              No courses yet.
            </p>
          ) : (
            <nav className="space-y-0.5">
              {courses.map((course) => {
                const isActive = pathname === `/courses/${course.id}`;
                return (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className={cn(
                      buttonVariants({
                        variant: isActive ? "secondary" : "ghost",
                      }),
                      "w-full justify-start gap-2 text-sm h-auto py-2",
                      !isActive && "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <BookOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate text-left">
                      {course.name}
                    </span>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
