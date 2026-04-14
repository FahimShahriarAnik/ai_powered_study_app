"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Course } from "@/types/database";
import type { User } from "@supabase/supabase-js";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "./app-sidebar";

export function TopNav({ user, courses }: { user: User | null; courses: Course[] }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayEmail = user?.email ?? (user ? "Guest" : "Not signed in");
  const initials = user?.email ? user.email[0].toUpperCase() : "G";

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "md:hidden"
            )}
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Open menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <AppSidebar courses={courses} />
          </SheetContent>
        </Sheet>

        <Link
          href="/"
          className="cursor-pointer font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity"
        >
          Cortex
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-full"
            )}
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="text-muted-foreground text-sm truncate" disabled>
              {displayEmail}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
