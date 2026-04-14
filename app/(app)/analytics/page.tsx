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

  // Confidence calibration stats (only from questions where user rated)
  const ratedAnswers = answersWithQuestions.filter((a) => a.confidence !== null && a.confidence > 0);
  const overconfident = ratedAnswers.filter((a) => a.confidence === 3 && !a.is_correct);
  const underconfident = ratedAnswers.filter((a) => a.confidence === 1 && a.is_correct);
  const showConfidenceCard = ratedAnswers.length >= 5;

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

      {/* Confidence Calibration */}
      {showConfidenceCard && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Confidence Calibration
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Based on {ratedAnswers.length} self-rated answer
              {ratedAnswers.length !== 1 ? "s" : ""}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-background p-4 text-center">
                <p className="text-2xl font-semibold text-destructive">
                  {overconfident.length}
                </p>
                <p className="mt-1 text-xs font-medium text-foreground">
                  Overconfident
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Confident · Got wrong
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-4 text-center">
                <p className="text-2xl font-semibold text-yellow-600 dark:text-yellow-400">
                  {underconfident.length}
                </p>
                <p className="mt-1 text-xs font-medium text-foreground">
                  Underconfident
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Unsure · Got right
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-4 text-center">
                <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                  {Math.round(
                    ((ratedAnswers.length - overconfident.length) /
                      ratedAnswers.length) *
                      100
                  )}
                  %
                </p>
                <p className="mt-1 text-xs font-medium text-foreground">
                  Well Calibrated
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Of rated answers
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
