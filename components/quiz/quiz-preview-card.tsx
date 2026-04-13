"use client";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { QuizWithQuestions } from "@/types/database";
import { ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

const DIFF_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  hard: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  mixed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const OPTION_LABELS = ["A", "B", "C", "D"];

export function QuizPreviewCard({ quiz }: { quiz: QuizWithQuestions }) {
  const [open, setOpen] = useState(false);
  const [revealedQuestions, setRevealedQuestions] = useState<Set<number>>(new Set());

  function toggleReveal(idx: number) {
    setRevealedQuestions((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-background">
        {/* Quiz header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {new Date(quiz.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <Badge
              className={cn(
                "shrink-0 text-xs border-0",
                DIFF_COLORS[quiz.difficulty] ?? DIFF_COLORS.mixed
              )}
            >
              {quiz.difficulty}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {quiz.question_count}Q
            </span>
            <CollapsibleTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            >
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Questions */}
        <CollapsibleContent>
          <div className="border-t border-border divide-y divide-border">
            {quiz.questions.map((q, idx) => {
              const revealed = revealedQuestions.has(idx);
              return (
                <div key={q.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      <span className="mr-1.5 text-muted-foreground">{idx + 1}.</span>
                      {q.question}
                    </p>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {q.topic}
                    </Badge>
                  </div>

                  {/* Options */}
                  <div className="space-y-1.5">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === q.correct_index;
                      return (
                        <div
                          key={optIdx}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                            revealed && isCorrect
                              ? "bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-300"
                              : "bg-muted/50 text-muted-foreground"
                          )}
                        >
                          <span className="shrink-0 font-medium">
                            {OPTION_LABELS[optIdx]}.
                          </span>
                          <span className="flex-1">{opt}</span>
                          {revealed && isCorrect && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Reveal / explanation */}
                  {revealed ? (
                    <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground">Explanation: </span>
                      {q.explanation}
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleReveal(idx)}
                      className="text-xs text-primary hover:underline"
                    >
                      Reveal answer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
