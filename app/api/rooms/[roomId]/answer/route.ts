import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const BASE_POINTS = 10;
const MAX_BONUS = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { questionIndex, selectedIndex } = (await request.json()) as {
    questionIndex: number;
    selectedIndex: number; // -1 = timed out (no answer recorded, still advances)
  };

  if (questionIndex === undefined || selectedIndex === undefined) {
    return NextResponse.json(
      { error: "questionIndex and selectedIndex required" },
      { status: 400 }
    );
  }

  // Verify room state
  const { data: room } = await supabase
    .from("quiz_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.status !== "active") {
    return NextResponse.json({ error: "Game not active" }, { status: 409 });
  }

  // Reject answers during the countdown phase
  if (
    room.question_started_at &&
    new Date(room.question_started_at).getTime() > Date.now()
  ) {
    return NextResponse.json(
      { error: "Game hasn't started yet" },
      { status: 409 }
    );
  }

  // Verify participant and their individual progress
  const { data: participant } = await supabase
    .from("room_participants")
    .select("id, score, current_question, finished_at")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }
  if (participant.finished_at) {
    return NextResponse.json({ error: "Already finished" }, { status: 409 });
  }
  if (participant.current_question !== questionIndex) {
    return NextResponse.json(
      { error: "Wrong question index" },
      { status: 409 }
    );
  }

  // Read correct_index from room_questions snapshot (admin to bypass RLS)
  const { data: roomQuestions } = await adminSupabase
    .from("room_questions")
    .select("position, correct_index")
    .eq("room_id", roomId)
    .order("position", { ascending: true });

  const question = (roomQuestions ?? [])[questionIndex];
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const totalQuestions = (roomQuestions ?? []).length;
  const isTimedOut = selectedIndex === -1;
  const isCorrect = !isTimedOut && selectedIndex === question.correct_index;

  // Record answer (skip for timeouts)
  if (!isTimedOut) {
    const { error: insertError } = await supabase.from("room_answers").insert({
      room_id: roomId,
      participant_id: participant.id,
      question_index: questionIndex,
      selected_index: selectedIndex,
      is_correct: isCorrect,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "Already answered" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Failed to record answer" },
        { status: 500 }
      );
    }
  }

  // Calculate and award points
  let points = 0;
  if (isCorrect) {
    const gameStartedAt = new Date(room.question_started_at!).getTime();
    const totalDurationMs =
      totalQuestions * room.question_duration_seconds * 1000;
    const elapsed = Date.now() - gameStartedAt;
    const remaining = Math.max(0, totalDurationMs - elapsed);
    const timeFraction = remaining / totalDurationMs;
    const timeBonus = Math.round(MAX_BONUS * timeFraction);
    points = BASE_POINTS + timeBonus;
    await supabase
      .from("room_participants")
      .update({ score: participant.score + points })
      .eq("id", participant.id);
  }

  // Advance this participant's question pointer
  const isLastQuestion = questionIndex + 1 >= totalQuestions;
  const finishedAt = isLastQuestion ? new Date().toISOString() : null;

  await supabase
    .from("room_participants")
    .update({
      current_question: questionIndex + 1,
      ...(finishedAt ? { finished_at: finishedAt } : {}),
    })
    .eq("id", participant.id);

  // If this was the last question, check if all participants are done
  if (isLastQuestion) {
    const { data: allParticipants } = await adminSupabase
      .from("room_participants")
      .select("id, finished_at")
      .eq("room_id", roomId);

    // Treat current participant as finished (DB update above may not reflect yet)
    const allDone = (allParticipants ?? []).every((p) =>
      p.id === participant.id ? true : p.finished_at !== null
    );

    if (allDone) {
      await adminSupabase
        .from("quiz_rooms")
        .update({ status: "finished" })
        .eq("id", roomId);
    }
  }

  return NextResponse.json({
    ok: true,
    isCorrect,
    points,
    correctIndex: question.correct_index,
    finished: isLastQuestion,
  });
}
