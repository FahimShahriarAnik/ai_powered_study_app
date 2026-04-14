import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Bot,
  Brain,
  ChartBar,
  Layers,
  Swords,
  Zap,
} from "lucide-react";
import Link from "next/link";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Upload Any Material",
    description:
      "Drop in PDFs or paste notes. Cortex extracts the content and makes it quiz-ready in seconds.",
  },
  {
    icon: Brain,
    title: "AI-Generated Quizzes",
    description:
      "Gemini Flash turns your materials into sharp multiple-choice questions — with explanations.",
  },
  {
    icon: Zap,
    title: "Adaptive Difficulty",
    description:
      "Smart Quiz analyses your weak topics and builds a personalised question set to close the gaps.",
  },
  {
    icon: ChartBar,
    title: "Strengths & Weaknesses",
    description:
      "Per-topic accuracy charts, rolling performance trends, and AI-generated study recommendations.",
  },
  {
    icon: Bot,
    title: "RAG Study Coach",
    description:
      "Chat with your uploaded materials. Ask anything — Cortex retrieves the right context and answers.",
  },
  {
    icon: Swords,
    title: "Competitive Quiz Rooms",
    description:
      "Challenge a friend in real-time 1v1 quiz battles. Live scoring, same questions, instant results.",
  },
];

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
];

const STEPS = [
  {
    step: "01",
    title: "Upload your materials",
    body: "Add PDFs or paste text for any course. Cortex indexes everything automatically.",
  },
  {
    step: "02",
    title: "Generate a quiz",
    body: "Pick a material and hit Generate. Get 5–20 tailored MCQs in under 10 seconds.",
  },
  {
    step: "03",
    title: "Track & improve",
    body: "Every answer is logged. Your dashboard surfaces weak topics and adapts future quizzes.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="cursor-pointer text-base font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity"
          >
            Cortex
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="cursor-pointer transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ size: "sm" }), "cursor-pointer")}
            >
              {isLoggedIn ? "Dashboard" : "Open app"}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Layers className="h-3 w-3" />
            AI-powered studying
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Study smarter,
            <br />
            not harder.
          </h1>
          <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Upload your course materials, generate quizzes, track your weak
            topics, and chat with an AI coach — all in one place.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ size: "lg" }), "cursor-pointer gap-2")}
            >
              {isLoggedIn ? "Go to Dashboard" : "Get started free"}
            </Link>
            <a
              href="#features"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "cursor-pointer gap-2"
              )}
            >
              See features
            </a>
          </div>
          {/* Stat strip */}
          <div className="mt-4 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            {[
              ["6+", "AI features"],
              ["Real-time", "quiz battles"],
              ["Per-topic", "analytics"],
            ].map(([val, label]) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <span className="text-xl font-semibold text-foreground">
                  {val}
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section
          id="features"
          className="border-t border-border bg-muted/30 px-6 py-20"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Everything you need to ace your exams
              </h2>
              <p className="mt-3 text-muted-foreground">
                Cortex weaves AI through every part of the study flow.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <h3 className="mb-1.5 font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <div className="mb-12 text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Up and running in minutes
              </h2>
              <p className="mt-3 text-muted-foreground">
                No setup, no config. Just sign in and start studying.
              </p>
            </div>
            <div className="relative grid gap-8 sm:grid-cols-3">
              {/* connector line (desktop) */}
              <div className="absolute left-0 right-0 top-5 hidden h-px bg-border sm:block" />
              {STEPS.map(({ step, title, body }) => (
                <div key={step} className="relative flex flex-col gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-xs font-bold text-primary">
                    {step}
                  </div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA banner ── */}
        <section className="border-t border-border bg-muted/30 px-6 py-16">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Ready to study smarter?
            </h2>
            <p className="text-muted-foreground">
              Sign in and add your first course in under a minute.
            </p>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ size: "lg" }), "cursor-pointer gap-2")}
            >
              {isLoggedIn ? "Go to Dashboard" : "Get started free"}
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Cortex</span>
          <span>Built for the BA student competition</span>
        </div>
      </footer>
    </div>
  );
}
