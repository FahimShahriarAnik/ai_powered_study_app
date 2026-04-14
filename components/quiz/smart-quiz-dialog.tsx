"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type MaterialOption = {
  id: string;
  title: string;
  course_id: string;
  course_name: string;
};

type Preset = "weak" | "balanced" | "strong";

const PRESETS: { value: Preset; label: string; description: string }[] = [
  { value: "weak", label: "Focus Weak", description: "60% weak · 30% medium · 10% strong" },
  { value: "balanced", label: "Balanced", description: "40% weak · 40% medium · 20% strong" },
  { value: "strong", label: "Challenge", description: "10% weak · 30% medium · 60% strong" },
];

interface Props {
  triggerLabel?: string;
  triggerClassName?: string;
  triggerVariant?: "default" | "secondary" | "outline";
  triggerSize?: "sm" | "default";
  iconOnly?: boolean;
}

export function SmartQuizDialog({
  triggerLabel = "Smart Quiz",
  triggerClassName,
  triggerVariant = "default",
  triggerSize = "sm",
  iconOnly = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preset, setPreset] = useState<Preset>("balanced");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingMaterials(true);
      setError(null);
      const supabase = createClient();
      const [materialsRes, coursesRes] = await Promise.all([
        supabase
          .from("materials")
          .select("id, title, course_id, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("courses").select("id, name"),
      ]);

      if (cancelled) return;

      if (materialsRes.error || coursesRes.error) {
        setError(materialsRes.error?.message ?? coursesRes.error?.message ?? "Failed to load");
        setLoadingMaterials(false);
        return;
      }

      const courseNameById = new Map(
        (coursesRes.data ?? []).map((c) => [c.id, c.name])
      );

      const opts: MaterialOption[] = (materialsRes.data ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        course_id: m.course_id,
        course_name: courseNameById.get(m.course_id) ?? "Course",
      }));

      setMaterials(opts);
      // Pre-select first material by default
      if (opts.length > 0 && selectedIds.size === 0) {
        setSelectedIds(new Set([opts[0].id]));
      }
      setLoadingMaterials(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleMaterial(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // keep at least one selected
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Group materials by course for display
  const byCourse = materials.reduce<Record<string, MaterialOption[]>>((acc, m) => {
    if (!acc[m.course_name]) acc[m.course_name] = [];
    acc[m.course_name].push(m);
    return acc;
  }, {});

  async function handleGenerate() {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-smart-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialIds: Array.from(selectedIds),
          questionCount: 10,
          preset,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Generation failed.");
        setSubmitting(false);
        return;
      }
      setOpen(false);
      setSubmitting(false);
      router.push(`/courses/${json.courseId}/quiz/${json.quizId}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(
          buttonVariants({ variant: triggerVariant, size: triggerSize }),
          "gap-1.5",
          triggerClassName
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {!iconOnly && triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Smart Quiz
          </DialogTitle>
        </DialogHeader>

        {/* Preset selector */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Quiz mode</p>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2.5 text-center transition-colors",
                  preset === p.value
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50"
                )}
              >
                <span className="text-xs font-medium">{p.label}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  {p.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Material multi-select */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Materials{" "}
            <span className="font-normal text-muted-foreground/60">
              ({selectedIds.size} selected)
            </span>
          </p>

          {loadingMaterials ? (
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 rounded-md border border-border bg-muted/30 animate-pulse"
                />
              ))}
            </div>
          ) : materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No materials yet. Upload a material to a course first.
            </p>
          ) : (
            <div className="max-h-52 overflow-y-auto rounded-md border border-border">
              {Object.entries(byCourse).map(([courseName, mats]) => (
                <div key={courseName}>
                  <p className="sticky top-0 bg-muted/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                    {courseName}
                  </p>
                  {mats.map((m) => {
                    const checked = selectedIds.has(m.id);
                    return (
                      <label
                        key={m.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted/40",
                          checked && "bg-primary/5"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMaterial(m.id)}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        <span
                          className={cn(
                            "flex-1 truncate leading-tight",
                            checked ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {m.title}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={submitting || loadingMaterials || selectedIds.size === 0}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {submitting ? "Generating…" : "Generate Smart Quiz"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
