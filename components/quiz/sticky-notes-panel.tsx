"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, StickyNote } from "lucide-react";
import { useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
}

export function StickyNotesPanel({ value, onChange, saveStatus }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-4 top-20 z-40 w-72 max-w-[calc(100vw-2rem)]">
      {open ? (
        <div className="rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <StickyNote className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              Notes
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {saveStatus === "saving" && "Saving…"}
                {saveStatus === "saved" && "Saved"}
                {saveStatus === "error" && "Save failed"}
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setOpen(false)}
                aria-label="Collapse notes"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Jot anything while you think…"
            className={cn(
              "block w-full resize-none bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
              "focus:outline-none min-h-[160px] rounded-b-lg"
            )}
          />
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="ml-auto flex gap-1.5 shadow-md"
        >
          <StickyNote className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
          Notes
          {value.trim().length > 0 && (
            <span className="ml-0.5 rounded-full bg-yellow-100 px-1.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
              {value.length}
            </span>
          )}
        </Button>
      )}
    </div>
  );
}
