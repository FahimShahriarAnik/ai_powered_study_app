import { createClient } from "@/lib/supabase/server";
import type { AnswerRecord, Question } from "@/types/database";
import { notFound, redirect } from "next/navigation";
import { ResultsClient } from "./results-client";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string; quizId: string; attemptId: string }>;
}) {
  const { id, quizId, attemptId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();

  if (!attempt) notFound();
  if (!attempt.completed_at) {
    redirect(`/courses/${id}/quiz/${quizId}`);
  }

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title, material_id, questions(*), materials!inner(title, course_id)")
    .eq("id", quizId)
    .single();

  if (!quiz) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quizAny = quiz as any;
  const material = quizAny.materials as { title: string; course_id: string };
  if (material.course_id !== id) notFound();

  const questions: Question[] = [...(quizAny.questions as Question[])].sort(
    (a, b) => a.position - b.position
  );

  const { data: records } = await supabase
    .from("answer_records")
    .select("*")
    .eq("attempt_id", attemptId);

  const recordByQuestion: Record<string, AnswerRecord> = {};
  for (const r of (records ?? []) as AnswerRecord[]) {
    recordByQuestion[r.question_id] = r;
  }

  return (
    <ResultsClient
      courseId={id}
      quizId={quizId}
      materialTitle={material.title}
      attempt={attempt}
      questions={questions}
      recordByQuestion={recordByQuestion}
    />
  );
}
