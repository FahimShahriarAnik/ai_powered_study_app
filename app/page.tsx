import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary" aria-hidden />
          <span className="font-semibold tracking-tight">StudyAI</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <section className="flex w-full max-w-xl flex-col items-start gap-6">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Study smarter with AI.
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Upload your materials, generate quizzes, and track your strengths and
            weaknesses — all in one place.
          </p>

          <div className="w-full rounded-lg border border-border bg-card p-6 text-card-foreground">
            <p className="text-sm font-medium">Phase 0 check</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Toggle the theme in the top right. Text should stay readable in
              light, dark, and system modes.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-4 text-sm text-muted-foreground">
        <span>StudyAI — Phase 0</span>
      </footer>
    </div>
  );
}
