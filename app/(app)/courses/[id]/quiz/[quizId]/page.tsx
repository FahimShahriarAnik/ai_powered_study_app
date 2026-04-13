import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { QuizRunner } from "./quiz-runner";
import type { Question } from "@/types/database";

export default async function QuizRunnerPage({
  params,
}: {
  params: Promise<{ id: string; quizId: string }>;
}) {
  const { id, quizId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title, question_count, material_id, questions(*), materials!inner(id, title, course_id)")
    .eq("id", quizId)
    .single();

  if (!quiz) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quizAny = quiz as any;
  const material = quizAny.materials as { id: string; title: string; course_id: string };
  if (material.course_id !== id) notFound();

  const questions: Question[] = [...(quizAny.questions as Question[])].sort(
    (a, b) => a.position - b.position
  );

  if (questions.length === 0) notFound();

  // Create a fresh attempt for this sitting. Refreshing creates a new one — acceptable.
  const { data: attempt, error: attemptErr } = await supabase
    .from("quiz_attempts")
    .insert({
      quiz_id: quizId,
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
