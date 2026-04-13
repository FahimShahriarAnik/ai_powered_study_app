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
  const [selectedId, setSelectedId] = useState<string>("");
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

      if (materialsRes.error) {
        setError(materialsRes.error.message);
        setLoadingMaterials(false);
        return;
      }
      if (coursesRes.error) {
        setError(coursesRes.error.message);
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
      if (opts.length > 0 && !selectedId) setSelectedId(opts[0].id);
      setLoadingMaterials(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, selectedId]);

  async function handleGenerate() {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-smart-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: selectedId, questionCount: 10 }),
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

        <p className="text-sm text-muted-foreground">
          Adaptive: 60% weak topics · 30% medium · 10% strong (harder
          difficulty). Falls back to a balanced quiz if you haven&rsquo;t done
          enough yet.
        </p>

        <div className="mt-1 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Material
          </label>
          {loadingMaterials ? (
            <div className="h-9 rounded-md border border-border bg-muted/30 animate-pulse" />
          ) : materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No materials yet. Upload a material to a course first.
            </p>
          ) : (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.course_name} — {m.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={
              submitting || loadingMaterials || !selectedId || materials.length === 0
            }
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
