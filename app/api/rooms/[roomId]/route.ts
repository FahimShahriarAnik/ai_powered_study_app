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

  // Verify user is a participant (access control gate)
  const { data: participant } = await supabase
    .from("room_participants")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  // Fetch all participants (includes current_question + finished_at)
  const { data: participants } = await supabase
    .from("room_participants")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });

  // Read from room_questions snapshot — open RLS, works for host and guests
  const { data: roomQuestions } = await supabase
    .from("room_questions")
    .select("id, quiz_id, position, question, options, topic, difficulty, explanation, created_at")
    .eq("room_id", roomId)
    .order("position", { ascending: true });

  const sanitized: SanitizedQuestion[] = (roomQuestions ?? []).map((q) => ({
    id: q.id,
    quiz_id: q.quiz_id,
    question: q.question,
    options: q.options as string[],
    topic: q.topic,
    difficulty: q.difficulty,
    explanation: q.explanation,
    position: q.position,
    created_at: q.created_at,
  }));

  // Fetch all answers for the room (needed for results breakdown)
  const { data: allAnswers } = await supabase
    .from("room_answers")
    .select("participant_id, question_index, is_correct")
    .eq("room_id", roomId);

  return NextResponse.json({
    room,
    participants: participants ?? [],
    questions: sanitized,
    myParticipantId: participant.id,
    answers: allAnswers ?? [],
  });
}
