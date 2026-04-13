import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AnswerWithQuestion = {
  id: string;
  attempt_id: string;
  question_id: string;
  is_correct: boolean;
  created_at: string;
  question: {
    topic: string;
    difficulty: string;
  };
};

export type CompletedAttempt = {
  id: string;
  score: number;
  total: number;
  completed_at: string;
};

export type UserAnalyticsData = {
  completedAttempts: CompletedAttempt[];
  answersWithQuestions: AnswerWithQuestion[];
  cachedInsight: Database["public"]["Tables"]["ai_insights"]["Row"] | null;
};

/**
 * Single server-side function that fetches everything the /analytics page
 * and /api/analytics/insights route need. RLS enforces user isolation.
 */
export async function getUserAnalyticsData(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserAnalyticsData> {
  const [attemptsResult, answersResult, insightResult] = await Promise.all([
    supabase
      .from("quiz_attempts")
      .select("id, score, total, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: true }),

    supabase
      .from("answer_records")
      .select(
        `id, attempt_id, question_id, is_correct, created_at,
         question:questions!answer_records_question_id_fkey(topic, difficulty)`
      )
      .order("created_at", { ascending: true }),

    supabase
      .from("ai_insights")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const completedAttempts = (attemptsResult.data ?? []) as CompletedAttempt[];
  const answersWithQuestions = (answersResult.data ?? []) as AnswerWithQuestion[];
  const cachedInsight = insightResult.data ?? null;

  return { completedAttempts, answersWithQuestions, cachedInsight };
}
