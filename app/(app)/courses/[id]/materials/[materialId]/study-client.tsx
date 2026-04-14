"use client";

import { Button } from "@/components/ui/button";
import type { Flashcard, FlashcardSetWithCards, Material } from "@/types/database";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  RotateCcw,
  Sparkles,
  StickyNote,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  material: Material;
  courseName: string;
  courseId: string;
  initialNote: string;
  initialFlashcardSets: FlashcardSetWithCards[];
}

// ── Notes Sidebar ─────────────────────────────────────────────────────────────

function NotesSidebar({
  materialId,
  initialNote,
}: {
  materialId: string;
  initialNote: string;
}) {
  const [content, setContent] = useState(initialNote);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (text: string) => {
      setSaveStatus("saving");
      await fetch("/api/material-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId, content: text }),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    [materialId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    setSaveStatus("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(val), 500);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="flex flex-col h-full rounded-lg border border-border bg-card overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <StickyNote className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          Notes
        </div>
        <span className="text-xs text-muted-foreground min-w-[50px] text-right">
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved ✓"}
        </span>
      </div>
      {/* Textarea */}
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Jot anything while you study…"
        className="flex-1 w-full resize-none bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
      />
    </div>
  );
}

// ── Flip Card ─────────────────────────────────────────────────────────────────

function FlipCard({ card, revealed }: { card: Flashcard; revealed: boolean }) {
  return (
    <div
      className="relative w-full mx-auto"
      style={{ perspective: "1200px", maxWidth: 560, height: 300 }}
    >
      <div className={`flip-card-inner absolute inset-0${revealed ? " flipped" : ""}`}>
        {/* Front */}
        <div className="flip-card-face absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border bg-card shadow-lg p-8 text-center">
          <span className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Term
          </span>
          <p className="text-xl font-semibold text-foreground leading-snug">{card.front}</p>
          <span className="mt-5 text-xs text-muted-foreground">Click to reveal</span>
        </div>
        {/* Back */}
        <div className="flip-card-face flip-card-back absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-primary/30 bg-primary/5 shadow-lg p-8 text-center">
          <span className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            Definition
          </span>
          <p className="text-base text-foreground leading-relaxed">{card.back}</p>
        </div>
      </div>
    </div>
  );
}

// ── Flashcard Viewer ──────────────────────────────────────────────────────────

function FlashcardViewer({ set }: { set: FlashcardSetWithCards }) {
  const cards = set.flashcards;
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const goTo = (next: number) => {
    setIndex(next);
    setRevealed(false);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        if (index < cards.length - 1) goTo(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        if (index > 0) goTo(index - 1);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setRevealed((r) => !r);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, cards.length]);

  const card = cards[index];
  if (!card) return null;

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm text-muted-foreground">
        Card {index + 1} of {cards.length}
      </p>
      <button
        onClick={() => setRevealed((r) => !r)}
        className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
        aria-label={revealed ? "Click to show term" : "Click to reveal definition"}
        style={{ maxWidth: 560 }}
      >
        <FlipCard card={card} revealed={revealed} />
      </button>
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" disabled={index === 0} onClick={() => goTo(index - 1)} aria-label="Previous card">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setRevealed((r) => !r)}>
          <RotateCcw className="h-4 w-4 mr-1.5" />
          {revealed ? "Show term" : "Reveal"}
        </Button>
        <Button variant="outline" size="icon" disabled={index === cards.length - 1} onClick={() => goTo(index + 1)} aria-label="Next card">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Use arrow keys to navigate · Space to flip
      </p>
    </div>
  );
}

// ── Flashcards Panel ──────────────────────────────────────────────────────────

function FlashcardsPanel({
  materialId,
  initialSets,
}: {
  materialId: string;
  initialSets: FlashcardSetWithCards[];
}) {
  const router = useRouter();
  const [sets, setSets] = useState(initialSets);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId }),
      });
      const data = await res.json() as { setId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => { setSets(initialSets); }, [initialSets]);

  const activeSet = sets.find((s) => s.id === activeSetId);

  if (activeSet) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setActiveSetId(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            All sets
          </Button>
          <span className="text-sm font-medium text-foreground">{activeSet.title}</span>
        </div>
        <FlashcardViewer set={activeSet} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sets.length > 0
            ? `${sets.length} flashcard ${sets.length === 1 ? "set" : "sets"}`
            : "No flashcard sets yet"}
        </p>
        <Button size="sm" onClick={generate} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {generating ? "Generating…" : "Generate Flashcards"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      )}

      {sets.length === 0 && !generating && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Layers className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No flashcards yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a set from this material to start studying
          </p>
        </div>
      )}

      {sets.length > 0 && (
        <div className="space-y-2">
          {sets.map((set) => (
            <button
              key={set.id}
              onClick={() => setActiveSetId(set.id)}
              className="w-full flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{set.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {set.flashcards.length} cards · {new Date(set.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Study Client ─────────────────────────────────────────────────────────

export function StudyClient({
  material,
  courseName,
  courseId,
  initialNote,
  initialFlashcardSets,
}: Props) {
  const [activeTab, setActiveTab] = useState<"read" | "flashcards">("read");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-4 shrink-0">
        <Link href={`/courses/${courseId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {courseName}
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-foreground truncate">{material.title}</h1>
          <p className="text-xs text-muted-foreground">
            {material.char_count.toLocaleString()} chars ·{" "}
            {new Date(material.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border px-6 pt-3 pb-0 shrink-0 flex items-center gap-1">
        <button
          onClick={() => setActiveTab("read")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors",
            activeTab === "read"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="h-4 w-4" />
          Read
        </button>
        <button
          onClick={() => setActiveTab("flashcards")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors",
            activeTab === "flashcards"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="h-4 w-4" />
          Flashcards
        </button>
      </div>

      {/* Body: main content + notes sidebar */}
      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* Main content area */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {activeTab === "read" && (
            <div className="h-full flex flex-col">
              {material.file_url ? (
                <iframe
                  src={material.file_url}
                  className="flex-1 w-full rounded-lg border border-border"
                  style={{ minHeight: "calc(100vh - 220px)" }}
                  title={material.title}
                />
              ) : (
                <div className="rounded-lg border border-border bg-card p-6 overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap font-mono">
                    {material.raw_text}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "flashcards" && (
            <div className="py-2">
              <FlashcardsPanel
                materialId={material.id}
                initialSets={initialFlashcardSets}
              />
            </div>
          )}
        </div>

        {/* Notes sidebar — always visible */}
        <div className="w-72 shrink-0 flex flex-col" style={{ minHeight: "calc(100vh - 220px)" }}>
          <NotesSidebar materialId={material.id} initialNote={initialNote} />
        </div>
      </div>
    </div>
  );
}
