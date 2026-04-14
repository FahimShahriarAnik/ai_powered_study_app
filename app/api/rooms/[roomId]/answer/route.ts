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

  const { questionIndex, selectedIndex } = (await request.json()) as {
    questionIndex: number;
    selectedIndex: number;
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
  if (room.current_question !== questionIndex) {
    return NextResponse.json(
      { error: "Question already advanced" },
      { status: 409 }
    );
  }

  // Verify participant
  const { data: participant } = await supabase
    .from("room_participants")
    .select("id, score")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  // Get the question's correct_index (server-side only)
  const { data: questions } = await supabase
    .from("questions")
    .select("id, correct_index, position")
    .eq("quiz_id", room.quiz_id)
    .order("position", { ascending: true });

  const question = (questions ?? [])[questionIndex];
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const isCorrect = selectedIndex === question.correct_index;

  // Insert answer (unique constraint prevents double-answer)
  const { error: insertError } = await supabase.from("room_answers").insert({
    room_id: roomId,
    participant_id: participant.id,
    question_index: questionIndex,
    selected_index: selectedIndex,
    is_correct: isCorrect,
  });

  if (insertError) {
    // Unique constraint violation = already answered
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Already answered" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Failed to record answer" },
      { status: 500 }
    );
  }

  // Update participant score if correct
  if (isCorrect) {
    await supabase
      .from("room_participants")
      .update({ score: participant.score + 1 })
      .eq("id", participant.id);
  }

  return NextResponse.json({ ok: true, isCorrect });
}
