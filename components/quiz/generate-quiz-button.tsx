"use client";

import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  materialId: string;
}

export function GenerateQuizButton({ materialId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setLoading(true);

    const res = await fetch("/api/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialId, questionCount: 10 }),
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
        size="sm"
        onClick={handleGenerate}
        disabled={loading}
        className="gap-1.5 text-xs shadow-sm"
      >
        <Zap className="h-3.5 w-3.5" />
        {loading ? "Generating…" : "Generate Quiz"}
      </Button>
      {error && (
        <p className="text-xs text-destructive max-w-[200px] text-right">{error}</p>
      )}
    </div>
  );
}
