import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { SanitizedQuestion } from "@/types/database";

export async function GET(
  _request: NextRequest,
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

  // Fetch room
  const { data: room } = await supabase
    .from("quiz_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Verify user is a participant
  const { data: participant } = await supabase
    .from("room_participants")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  // Fetch all participants
  const { data: participants } = await supabase
    .from("room_participants")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });

  // Fetch questions (strip correct_index — server enforces security)
  const { data: questions } = await supabase
    .from("questions")
    .select("id, quiz_id, question, options, topic, difficulty, explanation, position, created_at")
    .eq("quiz_id", room.quiz_id)
    .order("position", { ascending: true });

  const sanitized: SanitizedQuestion[] = (questions ?? []).map((q) => ({
    id: q.id,
    quiz_id: q.quiz_id,
    question: q.question,
    options: q.options,
    topic: q.topic,
    difficulty: q.difficulty,
    explanation: q.explanation,
    position: q.position,
    created_at: q.created_at,
  }));

  // Fetch answers for current question (so client knows who answered)
  const { data: currentAnswers } = await supabase
    .from("room_answers")
    .select("id, participant_id, question_index, is_correct, answered_at")
    // Never send selected_index back — only reveal after question closes
    .eq("room_id", roomId)
    .eq("question_index", room.current_question);

  return NextResponse.json({
    room,
    quiz: { id: room.quiz_id, question_count: sanitized.length },
    participants: participants ?? [],
    questions: sanitized,
    myParticipantId: participant.id,
    currentAnswers: currentAnswers ?? [],
  });
}
