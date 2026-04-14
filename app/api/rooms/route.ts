import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const QUESTION_DURATION_SECONDS = 30;

function generateRoomCode(): string {
  // Exclude visually ambiguous chars: 0, O, 1, I
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

function extractDisplayName(email: string): string {
  return email.split("@")[0].replace(/[._-]/g, " ").slice(0, 20) || "Player";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quizId } = (await request.json()) as { quizId: string };
  if (!quizId) {
    return NextResponse.json({ error: "quizId is required" }, { status: 400 });
  }

  // Verify quiz exists and has questions
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, question_count")
    .eq("id", quizId)
    .single();

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }
  if (quiz.question_count === 0) {
    return NextResponse.json(
      { error: "Quiz has no questions" },
      { status: 400 }
    );
  }

  // Fetch the actual questions now (host session — they own the quiz, RLS allows it)
  const { data: sourceQuestions } = await supabase
    .from("questions")
    .select("position, question, options, correct_index, topic, difficulty, explanation")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });

  if (!sourceQuestions || sourceQuestions.length === 0) {
    return NextResponse.json({ error: "No questions found for quiz" }, { status: 400 });
  }

  // Generate unique room code (retry on collision)
  let code = generateRoomCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from("quiz_rooms")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!existing) break;
    code = generateRoomCode();
    attempts++;
  }

  // Create room
  const { data: room, error: roomError } = await supabase
    .from("quiz_rooms")
    .insert({
      code,
      quiz_id: quizId,
      host_user_id: user.id,
      status: "waiting",
      current_question: 0,
      question_duration_seconds: QUESTION_DURATION_SECONDS,
      revealed_answers: {},
    })
    .select()
    .single();

  if (roomError || !room) {
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }

  // Snapshot questions into room_questions — open RLS so guests can read them
  const snapshot = sourceQuestions.map((q) => ({
    room_id: room.id,
    quiz_id: quizId,
    position: q.position,
    question: q.question,
    options: q.options,
    correct_index: q.correct_index,
    topic: q.topic,
    difficulty: q.difficulty,
    explanation: q.explanation,
  }));

  const { error: snapshotError } = await adminSupabase
    .from("room_questions")
    .insert(snapshot);

  if (snapshotError) {
    // Clean up orphan room — don't leave a room with no questions
    await supabase.from("quiz_rooms").delete().eq("id", room.id);
    return NextResponse.json(
      { error: "Failed to snapshot quiz questions" },
      { status: 500 }
    );
  }

  // Add host as first participant
  const displayName = extractDisplayName(user.email ?? user.id);
  const { data: participant, error: participantError } = await supabase
    .from("room_participants")
    .insert({
      room_id: room.id,
      user_id: user.id,
      display_name: displayName,
      score: 0,
    })
    .select()
    .single();

  if (participantError || !participant) {
    await supabase.from("quiz_rooms").delete().eq("id", room.id);
    return NextResponse.json(
      { error: "Failed to create participant" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    roomId: room.id,
    code: room.code,
    participantId: participant.id,
  });
}
