"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GenerateQuizButton } from "@/components/quiz/generate-quiz-button";
import { QuizPreviewCard } from "@/components/quiz/quiz-preview-card";
import { cn } from "@/lib/utils";
import type { Material, QuizWithAttempts } from "@/types/database";
import { ChevronDown, FileText } from "lucide-react";
import { useState } from "react";

interface Props {
  material: Material;
  quizzes: QuizWithAttempts[];
  courseId: string;
}

export function MaterialCard({ material, quizzes, courseId }: Props) {
  const [open, setOpen] = useState(false);

  const preview = material.raw_text.slice(0, 300).trim();
  const hasMore = material.raw_text.length > 300;

  return (
    <div className="rounded-lg border border-border bg-card space-y-0">
      {/* Material header */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {material.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {material.char_count.toLocaleString()} chars ·{" "}
                {new Date(material.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <GenerateQuizButton materialId={material.id} />
            <CollapsibleTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            >
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
              <span className="sr-only">Toggle preview</span>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t border-border px-4 pb-4 pt-3">
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {preview}
              {hasMore && (
                <span className="text-muted-foreground/60">
                  {" "}… ({material.raw_text.length.toLocaleString()} chars total)
                </span>
              )}
            </p>
            {material.file_url && (
              <a
                href={material.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <FileText className="h-3 w-3" />
                View original PDF
              </a>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Quizzes */}
      {quizzes.length > 0 && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {quizzes.length} {quizzes.length === 1 ? "Quiz" : "Quizzes"}
          </p>
          <div className="space-y-2">
            {quizzes.map((quiz) => (
              <QuizPreviewCard key={quiz.id} quiz={quiz} courseId={courseId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
