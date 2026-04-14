"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const QUESTION_COUNTS = [5, 7, 10, 12, 15];

interface Props {
  materialId: string;
}

export function GenerateQuizButton({ materialId }: Props) {
  const router = useRouter();
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setLoading(true);

    const res = await fetch("/api/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialId, questionCount: count }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Generation failed.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleGenerate}
        disabled={loading}
        className="gap-2 shadow-sm"
      >
        <Zap className="h-4 w-4" />
        {loading ? "Generating…" : "Generate Quiz"}
      </Button>
      {error && (
        <p className="text-xs text-destructive max-w-[200px] text-right">{error}</p>
      )}
    </div>
  );
}
