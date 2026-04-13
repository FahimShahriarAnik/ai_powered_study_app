import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-semibold tracking-tight text-foreground">
          Cortex
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Open app
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <section className="flex w-full max-w-xl flex-col items-start gap-6">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Study smarter with AI.
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Upload your materials, generate quizzes, and track your strengths
            and weaknesses — all in one place.
          </p>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Get started
          </Link>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-4 text-sm text-muted-foreground">
        <span>Cortex</span>
      </footer>
    </div>
  );
}
