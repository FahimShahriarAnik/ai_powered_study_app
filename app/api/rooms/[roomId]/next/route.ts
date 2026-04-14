import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fromQuestion } = (await request.json()) as { fromQuestion: number };

  const { data: room } = await supabase
    .from("quiz_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.host_user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the host can advance" },
      { status: 403 }
    );
  }
  if (room.status !== "active") {
    return NextResponse.json({ error: "Game not active" }, { status: 409 });
  }
  // Idempotency: already advanced
  if (room.current_question !== fromQuestion) {
    return NextResponse.json({ ok: true, alreadyAdvanced: true });
  }

  // Get correct_index for revealed_answers
  const { data: questions } = await supabase
    .from("questions")
    .select("id, correct_index, position")
    .eq("quiz_id", room.quiz_id)
    .order("position", { ascending: true });

  const allQuestions = questions ?? [];
  const currentQuestion = allQuestions[fromQuestion];

  const updatedRevealed = {
    ...room.revealed_answers,
    [String(fromQuestion)]: currentQuestion?.correct_index ?? 0,
  };

  const nextQuestion = fromQuestion + 1;
  const isLastQuestion = nextQuestion >= allQuestions.length;

  // NOTE: question_started_at is the game start time (set once when game starts).
  // We do NOT update it here — the total timer runs from that fixed timestamp.
  const { error } = await supabase
    .from("quiz_rooms")
    .update({
      revealed_answers: updatedRevealed,
      current_question: isLastQuestion ? fromQuestion : nextQuestion,
      status: isLastQuestion ? "finished" : "active",
    })
    .eq("id", roomId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to advance question" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, finished: isLastQuestion });
}
