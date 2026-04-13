import type { AnswerWithQuestion, CompletedAttempt } from "./queries";

export type TopicAccuracyPoint = {
  topic: string;
  correct: number;
  total: number;
  accuracy: number; // 0–1
};

export type RollingAccuracyPoint = {
  index: number;   // attempt number (1-based)
  accuracy: number; // 0–1
  date: string;    // short date label
};

export type HeatmapCell = {
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  correct: number;
  total: number;
  accuracy: number | null; // null = no data
};

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const ROLLING_WINDOW = 10;

/**
 * Returns per-topic accuracy, sorted ascending (weakest first).
 * Only includes topics with ≥ 2 answers to filter noise.
 */
export function topicAccuracy(
  answers: AnswerWithQuestion[]
): TopicAccuracyPoint[] {
  const map = new Map<string, { correct: number; total: number }>();

  for (const a of answers) {
    const topic = a.question?.topic ?? "Unknown";
    const cur = map.get(topic) ?? { correct: 0, total: 0 };
    map.set(topic, {
      correct: cur.correct + (a.is_correct ? 1 : 0),
      total: cur.total + 1,
    });
  }

  return Array.from(map.entries())
    .filter(([, v]) => v.total >= 2)
    .map(([topic, v]) => ({
      topic,
      correct: v.correct,
      total: v.total,
      accuracy: v.correct / v.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy); // weakest first
}

/**
 * Rolling accuracy over the last N completed attempts.
 */
export function rollingAccuracy(
  attempts: CompletedAttempt[],
  n = ROLLING_WINDOW
): RollingAccuracyPoint[] {
  const window = attempts.slice(-n);
  return window.map((a, i) => ({
    index: attempts.length - window.length + i + 1,
    accuracy: a.total > 0 ? (a.score ?? 0) / a.total : 0,
    date: new Date(a.completed_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));
}

/**
 * Topic × difficulty heatmap cells.
 * Returns every (topic, difficulty) combination that appears in the data,
 * plus null-accuracy cells for combinations with no answers.
 */
export function topicDifficultyMatrix(
  answers: AnswerWithQuestion[]
): { topics: string[]; cells: HeatmapCell[] } {
  // Build a map of topic → difficulty → {correct, total}
  type Inner = { correct: number; total: number };
  const map = new Map<string, Map<string, Inner>>();

  for (const a of answers) {
    const topic = a.question?.topic ?? "Unknown";
    const diff = a.question?.difficulty ?? "easy";

    if (!map.has(topic)) map.set(topic, new Map());
    const inner = map.get(topic)!;
    const cur = inner.get(diff) ?? { correct: 0, total: 0 };
    inner.set(diff, {
      correct: cur.correct + (a.is_correct ? 1 : 0),
      total: cur.total + 1,
    });
  }

  const topics = Array.from(map.keys()).sort();
  const cells: HeatmapCell[] = [];

  for (const topic of topics) {
    for (const difficulty of DIFFICULTIES) {
      const inner = map.get(topic)?.get(difficulty);
      cells.push({
        topic,
        difficulty,
        correct: inner?.correct ?? 0,
        total: inner?.total ?? 0,
        accuracy: inner ? inner.correct / inner.total : null,
      });
    }
  }

  return { topics, cells };
}

/**
 * Build a compact summary string for the Gemini prompt.
 * e.g. "Photosynthesis: 42% (7 answers); Cell Division: 91% (11 answers)"
 */
export function buildTopicSummaryForPrompt(
  points: TopicAccuracyPoint[]
): string {
  return points
    .map(
      (p) =>
        `${p.topic}: ${Math.round(p.accuracy * 100)}% (${p.total} answer${p.total !== 1 ? "s" : ""})`
    )
    .join("; ");
}
