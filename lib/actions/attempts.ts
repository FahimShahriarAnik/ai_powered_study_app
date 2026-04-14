"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateAttemptNotes(attemptId: string, notes: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("quiz_attempts")
    .update({ notes })
    .eq("id", attemptId);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function submitQuizAttempt(
  attemptId: string,
  answers: Array<{ questionId: string; selectedIndex: number; confidence?: number | null }>,
  notes: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: attempt, error: attemptErr } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_id, user_id, completed_at")
    .eq("id", attemptId)
    .single();

  if (attemptErr || !attempt) return { error: "Attempt not found" };
  if (attempt.user_id !== user.id) return { error: "Forbidden" };
  if (attempt.completed_at) return { error: "Already submitted" };

  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("id, correct_index")
    .eq("quiz_id", attempt.quiz_id);

  if (qErr || !questions) return { error: "Questions not found" };

  const correctMap = new Map(questions.map((q) => [q.id, q.correct_index]));

  let score = 0;
  const records = answers
    .filter((a) => correctMap.has(a.questionId))
    .map(({ questionId, selectedIndex, confidence }) => {
      const correctIdx = correctMap.get(questionId)!;
      const isCorrect = correctIdx === selectedIndex;
      if (isCorrect) score += 1;
      // confidence: store null if not rated or deselected (value 0)
      const confidenceVal = confidence && confidence > 0 ? confidence : null;
      return {
        attempt_id: attemptId,
        question_id: questionId,
        selected_index: selectedIndex,
        is_correct: isCorrect,
        confidence: confidenceVal,
      };
    });

  const { error: recordsErr } = await supabase
    .from("answer_records")
    .insert(records);

  if (recordsErr) return { error: recordsErr.message };

  const { error: updateErr } = await supabase
    .from("quiz_attempts")
    .update({
      score,
      notes,
      completed_at: new Date().toISOString(),
    })
    .eq("id", attemptId);

  if (updateErr) return { error: updateErr.message };

  revalidatePath(`/courses/${attempt.quiz_id}`, "layout");

  return { ok: true, score, total: questions.length };
}
