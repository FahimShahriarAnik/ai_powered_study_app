import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserAnalyticsData } from "@/lib/analytics/queries";
import {
  topicAccuracy,
  rollingAccuracy,
  topicDifficultyMatrix,
} from "@/lib/analytics/aggregations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsEmptyState } from "@/components/analytics/empty-state";
import { AiInsightsCard } from "@/components/analytics/ai-insights-card";
import { TopicAccuracyChart } from "@/components/analytics/topic-accuracy-chart";
import { RollingAccuracyChart } from "@/components/analytics/rolling-accuracy-chart";
import { TopicDifficultyHeatmap } from "@/components/analytics/topic-difficulty-heatmap";

const MIN_ATTEMPTS = 3;

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { completedAttempts, answersWithQuestions, cachedInsight } =
    await getUserAnalyticsData(supabase, user.id);

  const overallAccuracy =
    completedAttempts.length > 0
      ? Math.round(
          (completedAttempts.reduce(
            (sum, a) => sum + (a.score ?? 0) / a.total,
            0
          ) /
            completedAttempts.length) *
            100
        )
      : 0;

  if (completedAttempts.length < MIN_ATTEMPTS) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your strengths, weaknesses, and performance trends.
          </p>
        </div>
        <AnalyticsEmptyState completedCount={completedAttempts.length} />
      </div>
    );
  }

  const topicData = topicAccuracy(answersWithQuestions);
  const rollingData = rollingAccuracy(completedAttempts);
  const { topics, cells } = topicDifficultyMatrix(answersWithQuestions);

  const cachedInsightProp = cachedInsight
    ? {
        content: cachedInsight.content,
        attemptsAtRefresh: cachedInsight.attempts_at_refresh,
        updatedAt: cachedInsight.updated_at,
      }
    : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Based on {completedAttempts.length} completed quiz
            {completedAttempts.length !== 1 ? "zes" : ""} · {overallAccuracy}%
            overall accuracy
          </p>
        </div>
      </div>

      {/* AI Insights */}
      <AiInsightsCard
        cached={cachedInsightProp}
        currentAttemptCount={completedAttempts.length}
      />

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Topic Accuracy
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Sorted weakest → strongest (topics with ≥2 answers)
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {topicData.length > 0 ? (
              <TopicAccuracyChart data={topicData} />
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Not enough topic data yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Rolling Accuracy
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Last {Math.min(completedAttempts.length, 10)} attempts
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <RollingAccuracyChart data={rollingData} />
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Topic × Difficulty
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Accuracy by topic and difficulty level
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <TopicDifficultyHeatmap topics={topics} cells={cells} />
        </CardContent>
      </Card>
    </div>
  );
}
