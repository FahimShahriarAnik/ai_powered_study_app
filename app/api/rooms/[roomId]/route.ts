import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import type { SanitizedQuestion } from "@/types/database";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  // Auth check via regular server client (reads the user's session cookie)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // All DB reads use the admin client to bypass RLS.
  // This makes the endpoint work for both regular users and anonymous guests
  // who would otherwise be blocked by RLS policies on quiz_rooms / questions.
  const admin = createAdminClient();

  // Fetch room
  const { data: room } = await admin
    .from("quiz_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Verify user is a participant (still enforce this as an access control gate)
  const { data: participant } = await admin
    .from("room_participants")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  // Fetch all participants
  const { data: participants } = await admin
    .from("room_participants")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });

  // Fetch questions — strip correct_index so it's safe to send to the client
  const { data: questions } = await admin
    .from("questions")
    .select(
      "id, quiz_id, question, options, topic, difficulty, explanation, position, created_at"
    )
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

  // Fetch answers for current question
  const { data: currentAnswers } = await admin
    .from("room_answers")
    .select("id, participant_id, question_index, is_correct, answered_at")
    .eq("room_id", roomId)
    .eq("question_index", room.current_question);

  return NextResponse.json({
    room,
    participants: participants ?? [],
    questions: sanitized,
    myParticipantId: participant.id,
    currentAnswers: currentAnswers ?? [],
  });
}
