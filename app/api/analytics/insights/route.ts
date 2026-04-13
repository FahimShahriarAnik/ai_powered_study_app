import { analyticsInsightSchema } from "@/lib/ai/schemas";
import { getUserAnalyticsData } from "@/lib/analytics/queries";
import {
  topicAccuracy,
  buildTopicSummaryForPrompt,
} from "@/lib/analytics/aggregations";
import { createServerClient } from "@supabase/ssr";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";

const MIN_ATTEMPTS = 3;
const RATE_LIMIT_MS = 60_000; // 1 refresh per minute

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { completedAttempts, answersWithQuestions, cachedInsight } =
    await getUserAnalyticsData(supabase, user.id);

  if (completedAttempts.length < MIN_ATTEMPTS) {
    return NextResponse.json(
      { error: `Complete at least ${MIN_ATTEMPTS} quizzes to generate insights.` },
      { status: 400 }
    );
  }

  // Rate limit: 1 refresh per minute
  if (cachedInsight) {
    const elapsed = Date.now() - new Date(cachedInsight.updated_at).getTime();
    if (elapsed < RATE_LIMIT_MS) {
      const wait = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: `Please wait ${wait}s before refreshing insights.` },
        { status: 429 }
      );
    }
  }

  const topics = topicAccuracy(answersWithQuestions);

  if (topics.length === 0) {
    return NextResponse.json(
      { error: "Not enough topic data yet." },
      { status: 400 }
    );
  }

  const topicSummary = buildTopicSummaryForPrompt(topics);
  const totalAttempts = completedAttempts.length;
  const overallAccuracy = Math.round(
    (completedAttempts.reduce((sum, a) => sum + (a.score ?? 0) / a.total, 0) /
      totalAttempts) *
      100
  );

  console.log(
    `[analytics/insights] Generating for user ${user.id} — ${totalAttempts} attempts, ${topics.length} topics`
  );
  const t0 = Date.now();

  let result: Awaited<ReturnType<typeof generateObject<typeof analyticsInsightSchema>>>;
  try {
    result = await generateObject({
      model: google("gemini-3-flash-preview"),
      schema: analyticsInsightSchema,
      prompt: `You are a study performance analyst. Analyze this student's quiz performance and return structured insights.

Student stats:
- Total completed quizzes: ${totalAttempts}
- Overall accuracy: ${overallAccuracy}%
- Topic accuracy (sorted weakest → strongest): ${topicSummary}

Return:
- weakest: the topic with the lowest accuracy (match exactly the topic name from the data) and its accuracy as a decimal
- strongest: the topic with the highest accuracy (match exactly the topic name) and its accuracy as a decimal
- summary: 2–3 sentence paragraph describing overall performance, patterns, and progress areas
- recommendation: one actionable next-step sentence (e.g. "Focus on [topic] with targeted practice before reviewing stronger areas.")

Be specific, encouraging, and grounded in the data.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    console.error(`[analytics/insights] AI error after ${Date.now() - t0}ms:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  console.log(
    `[analytics/insights] AI responded in ${Date.now() - t0}ms`
  );

  const content = result.object;

  // Upsert into ai_insights (unique per user)
  const { error: upsertErr } = await supabase.from("ai_insights").upsert(
    {
      user_id: user.id,
      content,
      attempts_at_refresh: completedAttempts.length,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (upsertErr) {
    console.error("[analytics/insights] Upsert error:", upsertErr.message);
    return NextResponse.json({ error: "Failed to save insight" }, { status: 500 });
  }

  return NextResponse.json({ content, attemptsAtRefresh: completedAttempts.length });
}
