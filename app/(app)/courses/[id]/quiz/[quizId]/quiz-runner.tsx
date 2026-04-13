"use client";

import { StickyNotesPanel } from "@/components/quiz/sticky-notes-panel";
import { Button } from "@/components/ui/button";
import { updateAttemptNotes, submitQuizAttempt } from "@/lib/actions/attempts";
import { cn } from "@/lib/utils";
import type { Question } from "@/types/database";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const OPTION_LABELS = ["A", "B", "C", "D"];

interface Props {
  courseId: string;
  quizId: string;
  attemptId: string;
  materialTitle: string;
  questions: Question[];
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function QuizRunner({
  courseId,
  quizId,
  attemptId,
  materialTitle,
  questions,
}: Props) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const didMountRef = useRef(false);

  // Debounced notes auto-save
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setSaveStatus("saving");
    const t = setTimeout(async () => {
      const res = await updateAttemptNotes(attemptId, notes);
      setSaveStatus(res.error ? "error" : "saved");
    }, 500);
    return () => clearTimeout(t);
  }, [notes, attemptId]);

  const current = questions[currentIdx];
  const selected = answers[current.id];
  const isLast = currentIdx === questions.length - 1;
  const allAnswered = questions.every((q) => answers[q.id] !== undefined);
  const answeredCount = Object.keys(answers).length;
  const progressPct = Math.round((answeredCount / questions.length) * 100);

  function select(idx: number) {
    setAnswers((prev) => ({ ...prev, [current.id]: idx }));
  }

  function next() {
    if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1);
  }

  function back() {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  }

  async function handleSubmit() {
    if (!allAnswered || submitting) return;
    setSubmitError(null);
    setSubmitting(true);

    const answerArr = Object.entries(answers).map(([questionId, selectedIndex]) => ({
      questionId,
      selectedIndex,
    }));

    const res = await submitQuizAttempt(attemptId, answerArr, notes);

    if (res.error) {
      setSubmitError(res.error);
      setSubmitting(false);
      return;
    }

    router.push(`/courses/${courseId}/quiz/${quizId}/results/${attemptId}`);
  }

  return (
    <div className="mx-auto max-w-3xl p-6 pb-24">
      <StickyNotesPanel value={notes} onChange={setNotes} saveStatus={saveStatus} />

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Quiz
        </p>
        <h1 className="mt-0.5 text-xl font-semibold text-foreground">
          {materialTitle}
        </h1>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Question {currentIdx + 1} of {questions.length}
          </span>
          <span>
            {answeredCount} / {questions.length} answered
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-base font-medium text-foreground leading-relaxed">
          {current.question}
        </p>

        <div className="mt-4 space-y-2">
          {current.options.map((opt, idx) => {
            const isSelected = selected === idx;
            return (
              <button
                key={idx}
                onClick={() => select(idx)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-background text-foreground hover:border-muted-foreground/40 hover:bg-muted/50"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {OPTION_LABELS[idx]}
                </span>
                <span className="flex-1 leading-relaxed">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={back}
          disabled={currentIdx === 0}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>

        {isLast ? (
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="gap-1.5"
          >
            <Check className="h-4 w-4" />
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        ) : (
          <Button
            onClick={next}
            disabled={selected === undefined}
            className="gap-1.5"
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {submitError && (
        <p className="mt-3 text-right text-sm text-destructive">{submitError}</p>
      )}

      {/* Question dot nav */}
      <div className="mt-8 flex flex-wrap gap-1.5">
        {questions.map((q, idx) => {
          const answered = answers[q.id] !== undefined;
          const active = idx === currentIdx;
          return (
            <button
              key={q.id}
              onClick={() => setCurrentIdx(idx)}
              aria-label={`Go to question ${idx + 1}`}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : answered
                    ? "bg-primary/15 text-foreground hover:bg-primary/25"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
