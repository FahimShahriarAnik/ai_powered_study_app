"use client";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Course } from "@/types/database";
import { cn } from "@/lib/utils";
import { BarChart3, BookOpen, LayoutDashboard, Plus, Swords } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  courses: Course[];
}

export function AppSidebar({ courses }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-background">

      <ScrollArea className="flex-1 px-3 py-4">
        {/* Main nav */}
        <nav className="mb-4 space-y-1.5">
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({
                variant: pathname === "/dashboard" ? "secondary" : "ghost",
              }),
              "h-11 w-full justify-start gap-3 text-base font-medium"
            )}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            Dashboard
          </Link>
          <Link
            href="/analytics"
            className={cn(
              buttonVariants({
                variant: pathname === "/analytics" ? "secondary" : "ghost",
              }),
              "h-11 w-full justify-start gap-3 text-base font-medium"
            )}
          >
            <BarChart3 className="h-5 w-5 shrink-0" />
            Analytics
          </Link>
          <Link
            href="/rooms"
            className={cn(
              buttonVariants({
                variant:
                  pathname === "/rooms" || pathname.startsWith("/rooms/")
                    ? "secondary"
                    : "ghost",
              }),
              "h-11 w-full justify-start gap-3 text-base font-medium"
            )}
          >
            <Swords className="h-5 w-5 shrink-0" />
            Quiz Rooms
          </Link>
        </nav>

        <Separator className="my-3" />

        {/* Courses list */}
        <div className="mt-4">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Courses
            </span>
            <Link
              href="/dashboard?new=1"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-xs" }),
                "text-muted-foreground hover:text-foreground"
              )}
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">New course</span>
            </Link>
          </div>

          {courses.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No courses yet.
            </p>
          ) : (
            <nav className="space-y-1">
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
                      "w-full justify-start gap-2.5 text-sm h-auto py-2.5",
                      !isActive && "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <BookOpen className="h-4 w-4 shrink-0" />
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
