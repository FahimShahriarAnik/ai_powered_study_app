"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Material } from "@/types/database";
import { ChevronDown, FileText, Zap } from "lucide-react";
import { useState } from "react";

interface Props {
  material: Material;
}

export function MaterialCard({ material }: Props) {
  const [open, setOpen] = useState(false);

  const preview = material.raw_text.slice(0, 300).trim();
  const hasMore = material.raw_text.length > 300;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-card">
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
            <Button
              size="sm"
              variant="outline"
              disabled
              title="Coming in Phase 4"
              className="gap-1.5 text-xs"
            >
              <Zap className="h-3.5 w-3.5" />
              Generate Quiz
            </Button>

            <CollapsibleTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" })
              )}
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
                  {" "}
                  … ({material.raw_text.length.toLocaleString()} chars total)
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
      </div>
    </Collapsible>
  );
}
