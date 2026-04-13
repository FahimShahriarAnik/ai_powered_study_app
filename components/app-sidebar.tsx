"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BookOpen, LayoutDashboard, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MOCK_COURSES = [
  { id: "1", name: "Introduction to Statistics", materialCount: 4 },
  { id: "2", name: "Data Structures & Algorithms", materialCount: 2 },
  { id: "3", name: "Financial Accounting", materialCount: 6 },
  { id: "4", name: "Microeconomics", materialCount: 3 },
  { id: "5", name: "Machine Learning Fundamentals", materialCount: 1 },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Logo — visible on desktop (hidden on mobile since TopNav shows it) */}
      <div className="hidden h-14 items-center border-b border-border px-4 md:flex">
        <span className="font-semibold tracking-tight text-foreground">
          Cortex
        </span>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        {/* Main nav */}
        <nav className="mb-4 space-y-1">
          <Link href="/dashboard">
            <Button
              variant={pathname === "/dashboard" ? "secondary" : "ghost"}
              className="w-full justify-start gap-2 text-sm"
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              Dashboard
            </Button>
          </Link>
        </nav>

        <Separator className="my-2" />

        {/* Courses section */}
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Courses
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only">New course</span>
            </Button>
          </div>

          <nav className="space-y-0.5">
            {MOCK_COURSES.map((course) => {
              const isActive = pathname === `/courses/${course.id}`;
              return (
                <Link key={course.id} href={`/courses/${course.id}`}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-2 text-sm h-auto py-2",
                      !isActive && "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <BookOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate text-left">
                      {course.name}
                    </span>
                    <Badge
                      variant="secondary"
                      className="ml-auto shrink-0 text-xs px-1.5 py-0"
                    >
                      {course.materialCount}
                    </Badge>
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
      </ScrollArea>
    </div>
  );
}
