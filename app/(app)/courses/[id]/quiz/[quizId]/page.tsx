import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { QuizRunner } from "./quiz-runner";
import type { Question } from "@/types/database";

export default async function QuizRunnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; quizId: string }>;
  searchParams: Promise<{ filter?: string; fromAttempt?: string }>;
}) {
  const { id, quizId } = await params;
  const { filter, fromAttempt } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quizRaw } = await supabase
    .from("quizzes")
    .select("id, title, question_count, material_id")
    .eq("id", quizId)
    .single();

  if (!quizRaw) notFound();

  const { data: material } = await supabase
    .from("materials")
    .select("id, title, course_id")
    .eq("id", quizRaw.material_id)
    .single();

  if (!material || material.course_id !== id) notFound();

  const { data: questionsRaw } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });

  let questions: Question[] = questionsRaw ?? [];

  if (questions.length === 0) notFound();

  // Retry-wrong mode: filter to only incorrect questions from a prior attempt
  if (filter === "wrong" && fromAttempt) {
    const { data: wrongRecords } = await supabase
      .from("answer_records")
      .select("question_id")
      .eq("attempt_id", fromAttempt)
      .eq("is_correct", false);

    if (wrongRecords && wrongRecords.length > 0) {
      const wrongIds = new Set(wrongRecords.map((r) => r.question_id));
      questions = questions.filter((q) => wrongIds.has(q.id));
    }
  }

  if (questions.length === 0) notFound();

  // Create a fresh attempt for this sitting. Refreshing creates a new one — acceptable.
  const { data: attempt, error: attemptErr } = await supabase
    .from("quiz_attempts")
    .insert({
      quiz_id: quizRaw.id,
      user_id: user.id,
      total: questions.length,
    })
    .select("id")
    .single();

  if (attemptErr || !attempt) {
    throw new Error(attemptErr?.message ?? "Failed to start attempt");
  }

  return (
    <QuizRunner
      courseId={id}
      quizId={quizId}
      attemptId={attempt.id}
      materialTitle={material.title}
      questions={questions}
    />
  );
}
