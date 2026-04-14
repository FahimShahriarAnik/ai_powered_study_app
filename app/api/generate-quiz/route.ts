import { quizSchema } from "@/lib/ai/schemas";
import { createServerClient } from "@supabase/ssr";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";

const MAX_QUESTIONS = 15;
const RATE_LIMIT_MS = 60_000; // 1 minute per material
const MAX_TEXT_CHARS = 15_000; // truncate to avoid token bloat

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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { materialId, questionCount = MAX_QUESTIONS } = await request.json() as {
    materialId: string;
    questionCount?: number;
  };

  if (!materialId) {
    return NextResponse.json({ error: "materialId is required" }, { status: 400 });
  }

  // Fetch material
  const { data: material } = await supabase
    .from("materials")
    .select("id, title, raw_text, course_id")
    .eq("id", materialId)
    .single();

  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  // Verify course belongs to user (RLS handles this, but explicit check for clarity)
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", material.course_id)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  // Rate limit: 1 quiz per material per minute
  const { data: recentQuiz } = await supabase
    .from("quizzes")
    .select("created_at")
    .eq("material_id", materialId)
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
  const rawText = material.raw_text.slice(0, MAX_TEXT_CHARS);

  console.log(`[generate-quiz] Starting generation — material: "${material.title}", questions: ${count}, chars: ${rawText.length}`);
  const t0 = Date.now();

  // Generate with Gemini
  let result: Awaited<ReturnType<typeof generateObject<typeof quizSchema>>>;
  try {
    result = await generateObject({
      model: google("gemini-3-flash-preview"),
      schema: quizSchema,
      prompt: `You are an expert quiz generator. Generate exactly ${count} multiple-choice questions from the study material below.

Rules:
- Each question must have exactly 4 answer options
- correct_index is 0-based (0 = first option, 3 = last option)
- topic: short concept label (2–5 words) from the material
- difficulty: "easy" (recall), "medium" (understanding), "hard" (application/analysis)
- explanation: 2–3 sentences explaining why the correct answer is right
- Base questions strictly on the provided material

Study material:
${rawText}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    console.error(`[generate-quiz] AI error after ${Date.now() - t0}ms:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  console.log(`[generate-quiz] AI responded in ${Date.now() - t0}ms — ${result.object.questions.length} questions`);
  const { questions } = result.object;

  // Save quiz
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .insert({
      material_id: materialId,
      title: `Quiz — ${material.title}`,
      difficulty: "mixed",
      question_count: questions.length,
    })
    .select()
    .single();

  if (quizError || !quiz) {
    return NextResponse.json({ error: "Failed to save quiz" }, { status: 500 });
  }

  // Save questions
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

  console.log(`[generate-quiz] Done — quiz ${quiz.id} saved in ${Date.now() - t0}ms total`);
  return NextResponse.json({ quizId: quiz.id });
}
