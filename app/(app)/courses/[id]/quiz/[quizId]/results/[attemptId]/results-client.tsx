"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { AnswerRecord, Question, QuizAttempt } from "@/types/database";
import { CheckCircle2, ChevronDown, Sparkles, StickyNote, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const OPTION_LABELS = ["A", "B", "C", "D"];

interface Props {
  courseId: string;
  quizId: string;
  materialTitle: string;
  attempt: QuizAttempt;
  questions: Question[];
  recordByQuestion: Record<string, AnswerRecord>;
}

export function ResultsClient({
  courseId,
  quizId,
  materialTitle,
  attempt,
  questions,
  recordByQuestion,
}: Props) {
  const total = attempt.total;
  const score = attempt.score ?? 0;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Score summary */}
      <div className="mb-6 rounded-lg border border-border bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Results
        </p>
        <h1 className="mt-0.5 text-xl font-semibold text-foreground">
          {materialTitle}
        </h1>

        <div className="mt-4 flex items-end gap-6">
          <div>
            <p className="text-5xl font-semibold tabular-nums text-foreground">
              {score}
              <span className="text-2xl text-muted-foreground">/{total}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {pct}% correct
            </p>
          </div>

          <div className="flex flex-1 flex-wrap gap-2">
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
              <CheckCircle2 className="h-3 w-3" />
              {score} correct
            </Badge>
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0">
              <XCircle className="h-3 w-3" />
              {total - score} incorrect
            </Badge>
            {attempt.completed_at && (
              <Badge variant="outline">
                {new Date(attempt.completed_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/courses/${courseId}/quiz/${quizId}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Retake Quiz
          </Link>
          <Link
            href={`/courses/${courseId}`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Back to Course
          </Link>
        </div>
      </div>

      {/* Notes */}
      {attempt.notes.trim().length > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <StickyNote className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm font-medium text-foreground">Your notes</p>
          </div>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
            {attempt.notes}
          </p>
        </div>
      )}

      {/* Per-question breakdown */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Question breakdown
        </p>
        {questions.map((q, idx) => (
          <QuestionResult
            key={q.id}
            index={idx}
            question={q}
            record={recordByQuestion[q.id]}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionResult({
  index,
  question,
  record,
}: {
  index: number;
  question: Question;
  record: AnswerRecord | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [eli5Text, setEli5Text] = useState("");
  const [eli5State, setEli5State] = useState<"idle" | "streaming" | "error">("idle");
  const [eli5Visible, setEli5Visible] = useState(false);

  const selected = record?.selected_index;
  const isCorrect = record?.is_correct ?? false;

  async function runEli5() {
    if (eli5State === "streaming") return;
    setEli5Visible(true);
    if (eli5Text.length > 0) return; // already fetched — just toggle visible
    setEli5State("streaming");
    setEli5Text("");

    try {
      const res = await fetch("/api/eli5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id }),
      });

      if (!res.ok || !res.body) {
        setEli5State("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accum = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accum += decoder.decode(value, { stream: true });
        setEli5Text(accum);
      }
      setEli5State("idle");
    } catch {
      setEli5State("error");
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-start gap-3 p-4">
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              isCorrect
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}
          >
            {isCorrect ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground leading-snug">
              <span className="mr-1.5 text-muted-foreground">{index + 1}.</span>
              {question.question}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {question.topic}
              </Badge>
              <span className="text-xs text-muted-foreground capitalize">
                {question.difficulty}
              </span>
            </div>
          </div>

          <CollapsibleTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            aria-label="Toggle details"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
            {/* Options */}
            <div className="space-y-1.5">
              {question.options.map((opt, optIdx) => {
                const isCorrectOpt = optIdx === question.correct_index;
                const isSelectedOpt = optIdx === selected;
                return (
                  <div
                    key={optIdx}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-3 py-2 text-sm",
                      isCorrectOpt
                        ? "bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-300"
                        : isSelectedOpt
                          ? "bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-300"
                          : "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <span className="shrink-0 font-medium">
                      {OPTION_LABELS[optIdx]}.
                    </span>
                    <span className="flex-1 leading-relaxed">{opt}</span>
                    <span className="shrink-0 text-xs">
                      {isCorrectOpt && "Correct"}
                      {!isCorrectOpt && isSelectedOpt && "Your answer"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Explanation */}
            <div className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Explanation: </span>
              {question.explanation}
            </div>

            {/* ELI5 */}
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (eli5Visible && eli5State !== "streaming") {
                    setEli5Visible(false);
                  } else {
                    runEli5();
                  }
                }}
                disabled={eli5State === "streaming"}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {eli5State === "streaming"
                  ? "Thinking…"
                  : eli5Visible
                    ? "Hide ELI5"
                    : "Explain like I'm 5"}
              </Button>

              {eli5Visible && (
                <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-foreground">
                  {eli5State === "error" ? (
                    <span className="text-destructive">
                      Something went wrong. Try again.
                    </span>
                  ) : eli5Text.length === 0 && eli5State === "streaming" ? (
                    <span className="text-muted-foreground">Generating…</span>
                  ) : (
                    <span className="whitespace-pre-wrap">{eli5Text}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
