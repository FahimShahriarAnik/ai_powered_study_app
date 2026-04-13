"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SmartQuizDialog } from "@/components/quiz/smart-quiz-dialog";
import { Sparkles, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import type { AiInsightContent } from "@/types/database";

interface Props {
  cached: {
    content: AiInsightContent;
    attemptsAtRefresh: number;
    updatedAt: string;
  } | null;
  currentAttemptCount: number;
}

export function AiInsightsCard({ cached, currentAttemptCount }: Props) {
  const [insight, setInsight] = useState<AiInsightContent | null>(
    cached?.content ?? null
  );
  const [attemptsAtRefresh, setAttemptsAtRefresh] = useState<number>(
    cached?.attemptsAtRefresh ?? 0
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newAttemptsSince = currentAttemptCount - attemptsAtRefresh;
  const isStale = newAttemptsSince >= 3;

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/insights", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to generate insights.");
        return;
      }
      setInsight(json.content as AiInsightContent);
      setAttemptsAtRefresh(json.attemptsAtRefresh as number);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Insights
        </CardTitle>
        <div className="flex items-center gap-2">
          {isStale && (
            <Badge variant="secondary" className="text-xs">
              {newAttemptsSince} new attempt{newAttemptsSince !== 1 ? "s" : ""} — regenerate?
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Generating…" : insight ? "Refresh" : "Generate insights"}
          </Button>
          <SmartQuizDialog
            triggerLabel="Generate focused quiz on weak topic"
            triggerVariant="secondary"
            triggerSize="sm"
          />
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <p className="text-sm text-destructive mb-3">{error}</p>
        )}

        {!insight && !loading && (
          <p className="text-sm text-muted-foreground">
            Click &ldquo;Generate insights&rdquo; to get an AI-powered analysis of your performance.
          </p>
        )}

        {loading && !insight && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Analyzing your performance…
          </div>
        )}

        {insight && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                    Weakest topic
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {insight.weakest.topic}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(insight.weakest.accuracy * 100)}% accuracy
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                    Strongest topic
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {insight.strongest.topic}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(insight.strongest.accuracy * 100)}% accuracy
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm text-foreground leading-relaxed">
                {insight.summary}
              </p>
              <p className="text-sm font-medium text-primary">
                {insight.recommendation}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
