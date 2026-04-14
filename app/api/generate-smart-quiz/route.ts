import { quizSchema } from "@/lib/ai/schemas";
import { createServerClient } from "@supabase/ssr";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";
import {
  getUserTopicStats,
  planSmartQuiz,
  buildSmartQuizPromptContext,
  type SmartQuizPreset,
} from "@/lib/analytics/user-stats";

const MAX_QUESTIONS = 10;
const RATE_LIMIT_MS = 60_000;
const MAX_TEXT_CHARS = 15_000;
const MAX_TEXT_PER_MATERIAL = 5_000; // per-material cap when combining multiple

export async function POST(request: NextRequest) {
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

  const {
    materialId,
    materialIds: rawMaterialIds,
    questionCount = MAX_QUESTIONS,
    preset = "balanced",
  } = (await request.json()) as {
    materialId?: string;
    materialIds?: string[];
    questionCount?: number;
    preset?: SmartQuizPreset;
  };

  // Support both legacy single materialId and new multi-material materialIds
  const materialIds: string[] =
    rawMaterialIds && rawMaterialIds.length > 0
      ? rawMaterialIds
      : materialId
        ? [materialId]
        : [];

  if (materialIds.length === 0) {
    return NextResponse.json({ error: "At least one material is required" }, { status: 400 });
  }

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, raw_text, course_id")
    .in("id", materialIds);

  if (!materials || materials.length === 0) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  // Use the first material as the primary (for quiz record FK)
  const primaryMaterial = materials[0];
  const primaryMaterialId = primaryMaterial.id;

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", primaryMaterial.course_id)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  // Rate limit: check primary material's most recent quiz
  const { data: recentQuiz } = await supabase
    .from("quizzes")
    .select("created_at")
    .eq("material_id", primaryMaterialId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (recentQuiz) {
    const elapsed = Date.now() - new Date(recentQuiz.created_at).getTime();
    if (elapsed < RATE_LIMIT_MS) {
      const wait = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: `Please wait ${wait}s before generating another quiz for this material.` },
        { status: 429 }
      );
    }
  }

  const count = Math.min(Math.max(1, questionCount), MAX_QUESTIONS);
  const validPreset: SmartQuizPreset =
    preset === "weak" || preset === "balanced" || preset === "strong" ? preset : "balanced";

  // Combine text from all materials with per-material cap
  const charPerMaterial = Math.max(
    Math.floor(MAX_TEXT_CHARS / materials.length),
    MAX_TEXT_PER_MATERIAL
  );
  const rawText = materials
    .map(
      (m, i) =>
        `--- Material ${i + 1}: ${m.title} ---\n${m.raw_text.slice(0, charPerMaterial)}`
    )
    .join("\n\n");

  const stats = await getUserTopicStats(supabase, user.id);
  const plan = planSmartQuiz(stats, count, validPreset);
  const context = buildSmartQuizPromptContext(stats, plan);

  console.log(
    `[generate-smart-quiz] materials="${materials.map((m) => m.title).join(", ")}" preset=${validPreset} user=${user.id} fallback=${plan.fallback} weak/med/strong=${plan.weakCount}/${plan.mediumCount}/${plan.strongCount}`
  );
  const t0 = Date.now();

  let result: Awaited<ReturnType<typeof generateObject<typeof quizSchema>>>;
  try {
    result = await generateObject({
      model: google("gemini-3-flash-preview"),
      schema: quizSchema,
      prompt: `You are an adaptive quiz generator. Generate exactly ${count} multiple-choice questions from the study material below, personalized to the student's performance history.

Rules:
- Each question must have exactly 4 answer options
- correct_index is 0-based (0 = first option, 3 = last option)
- topic: short concept label (2–5 words) from the material
- difficulty: "easy" (recall), "medium" (understanding), "hard" (application/analysis)
- explanation: 2–3 sentences explaining why the correct answer is right
- Base every question strictly on the provided material
- Follow the target distribution below as closely as the material allows

${context}

Study material:
${rawText}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    console.error(
      `[generate-smart-quiz] AI error after ${Date.now() - t0}ms:`,
      message
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }

  console.log(
    `[generate-smart-quiz] AI responded in ${Date.now() - t0}ms — ${result.object.questions.length} questions`
  );
  const { questions } = result.object;

  const quizTitle =
    materials.length > 1
      ? `Smart Quiz — ${materials.map((m) => m.title).join(", ")}`
      : `Smart Quiz — ${primaryMaterial.title}`;

  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .insert({
      material_id: primaryMaterialId,
      title: quizTitle,
      difficulty: "adaptive",
      question_count: questions.length,
    })
    .select()
    .single();

  if (quizError || !quiz) {
    return NextResponse.json({ error: "Failed to save quiz" }, { status: 500 });
  }

  const { error: questionsError } = await supabase.from("questions").insert(
    questions.map((q, i) => ({
      quiz_id: quiz.id,
      question: q.question,
      options: q.options,
      correct_index: q.correct_index,
      topic: q.topic,
      difficulty: q.difficulty,
      explanation: q.explanation,
      position: i,
    }))
  );

  if (questionsError) {
    return NextResponse.json({ error: "Failed to save questions" }, { status: 500 });
  }

  console.log(
    `[generate-smart-quiz] Done — quiz ${quiz.id} saved in ${Date.now() - t0}ms total`
  );

  return NextResponse.json({
    quizId: quiz.id,
    courseId: primaryMaterial.course_id,
    plan,
    fallback: plan.fallback,
  });
}
