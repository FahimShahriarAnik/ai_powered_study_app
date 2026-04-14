import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { topicAccuracy, type TopicAccuracyPoint } from "./aggregations";

export type TopicBucket = "weak" | "medium" | "strong";

export type BucketedTopics = {
  weak: TopicAccuracyPoint[];
  medium: TopicAccuracyPoint[];
  strong: TopicAccuracyPoint[];
};

export type UserTopicStats = {
  hasEnoughData: boolean;
  totalAnswers: number;
  allTopics: TopicAccuracyPoint[];
  bucketed: BucketedTopics;
};

const WEAK_THRESHOLD = 0.5;
const STRONG_THRESHOLD = 0.8;
const MIN_ANSWERS_FOR_ADAPTATION = 5;

export function bucketTopics(points: TopicAccuracyPoint[]): BucketedTopics {
  const weak: TopicAccuracyPoint[] = [];
  const medium: TopicAccuracyPoint[] = [];
  const strong: TopicAccuracyPoint[] = [];

  for (const p of points) {
    if (p.accuracy < WEAK_THRESHOLD) weak.push(p);
    else if (p.accuracy >= STRONG_THRESHOLD) strong.push(p);
    else medium.push(p);
  }

  return { weak, medium, strong };
}

export async function getUserTopicStats(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserTopicStats> {
  const { data } = await supabase
    .from("answer_records")
    .select(
      `id, attempt_id, question_id, is_correct, created_at,
       question:questions!answer_records_question_id_fkey(topic, difficulty),
       attempt:quiz_attempts!answer_records_attempt_id_fkey(user_id)`
    );

  const rows = (data ?? []) as Array<{
    id: string;
    attempt_id: string;
    question_id: string;
    is_correct: boolean;
    confidence: number | null;
    created_at: string;
    question: { topic: string; difficulty: string } | null;
    attempt: { user_id: string } | null;
  }>;

  const userRows = rows.filter((r) => r.attempt?.user_id === userId && r.question);

  const answersForAggregation = userRows.map((r) => ({
    id: r.id,
    attempt_id: r.attempt_id,
    question_id: r.question_id,
    is_correct: r.is_correct,
    confidence: r.confidence,
    created_at: r.created_at,
    question: r.question!,
  }));

  const allTopics = topicAccuracy(answersForAggregation);
  const bucketed = bucketTopics(allTopics);

  return {
    hasEnoughData: userRows.length >= MIN_ANSWERS_FOR_ADAPTATION && allTopics.length > 0,
    totalAnswers: userRows.length,
    allTopics,
    bucketed,
  };
}

export type SmartQuizPreset = "weak" | "balanced" | "strong";

export type SmartQuizPlan = {
  weakCount: number;
  mediumCount: number;
  strongCount: number;
  fallback: boolean;
  preset: SmartQuizPreset;
};

const PRESET_DISTRIBUTIONS: Record<
  SmartQuizPreset,
  { weakPct: number; mediumPct: number; strongPct: number }
> = {
  weak: { weakPct: 0.6, mediumPct: 0.3, strongPct: 0.1 },
  balanced: { weakPct: 0.4, mediumPct: 0.4, strongPct: 0.2 },
  strong: { weakPct: 0.1, mediumPct: 0.3, strongPct: 0.6 },
};

export function planSmartQuiz(
  stats: UserTopicStats,
  totalQuestions: number,
  preset: SmartQuizPreset = "balanced"
): SmartQuizPlan {
  if (!stats.hasEnoughData) {
    return {
      weakCount: 0,
      mediumCount: totalQuestions,
      strongCount: 0,
      fallback: true,
      preset,
    };
  }

  const { weak, medium, strong } = stats.bucketed;
  const dist = PRESET_DISTRIBUTIONS[preset];

  let weakCount = Math.round(totalQuestions * dist.weakPct);
  let mediumCount = Math.round(totalQuestions * dist.mediumPct);
  let strongCount = totalQuestions - weakCount - mediumCount;

  if (weak.length === 0) {
    mediumCount += weakCount;
    weakCount = 0;
  }
  if (medium.length === 0) {
    const toRedistribute = mediumCount;
    mediumCount = 0;
    if (weak.length > 0) weakCount += toRedistribute;
    else strongCount += toRedistribute;
  }
  if (strong.length === 0) {
    const toRedistribute = strongCount;
    strongCount = 0;
    if (medium.length > 0) mediumCount += toRedistribute;
    else weakCount += toRedistribute;
  }

  return { weakCount, mediumCount, strongCount, fallback: false, preset };
}

export function buildSmartQuizPromptContext(
  stats: UserTopicStats,
  plan: SmartQuizPlan
): string {
  if (plan.fallback) {
    return `The student has not completed enough quizzes yet for adaptive targeting. Generate a balanced mix of easy, medium, and hard questions across the material's topics.`;
  }

  const presetLabel = plan.preset === "weak" ? "Focus on weak areas" : plan.preset === "strong" ? "Challenge mode" : "Balanced mix";

  const lines: string[] = [];
  lines.push(`Quiz mode: ${presetLabel}`);
  lines.push("Student performance history (use this to guide question selection):");

  if (stats.bucketed.weak.length > 0) {
    const list = stats.bucketed.weak
      .map((t) => `${t.topic} (${Math.round(t.accuracy * 100)}%)`)
      .join(", ");
    lines.push(`- WEAK topics (priority): ${list}`);
  }
  if (stats.bucketed.medium.length > 0) {
    const list = stats.bucketed.medium
      .map((t) => `${t.topic} (${Math.round(t.accuracy * 100)}%)`)
      .join(", ");
    lines.push(`- MEDIUM topics: ${list}`);
  }
  if (stats.bucketed.strong.length > 0) {
    const list = stats.bucketed.strong
      .map((t) => `${t.topic} (${Math.round(t.accuracy * 100)}%)`)
      .join(", ");
    lines.push(`- STRONG topics: ${list}`);
  }

  lines.push("");
  lines.push("Target distribution for this quiz:");
  if (plan.weakCount > 0) {
    lines.push(
      `- ~${plan.weakCount} question(s) targeting WEAK topics from the material. Use "easy" or "medium" difficulty so the student can rebuild confidence.`
    );
  }
  if (plan.mediumCount > 0) {
    lines.push(
      `- ~${plan.mediumCount} question(s) on MEDIUM topics, primarily "medium" difficulty to reinforce partial mastery.`
    );
  }
  if (plan.strongCount > 0) {
    lines.push(
      `- ~${plan.strongCount} question(s) on STRONG topics at "hard" difficulty to push the student further.`
    );
  }
  lines.push("");
  lines.push(
    "If the material does not cover a listed topic, substitute with the closest related topic from the material. Topic labels in output must come from the material itself."
  );

  return lines.join("\n");
}
