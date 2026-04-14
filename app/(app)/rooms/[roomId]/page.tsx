import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { RoomClient } from "./room-client";
import type { SanitizedQuestion } from "@/types/database";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch room
  const { data: room } = await supabase
    .from("quiz_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) notFound();

  // Verify user is a participant
  const { data: myParticipant } = await supabase
    .from("room_participants")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!myParticipant) {
    redirect("/rooms");
  }

  // Fetch all participants
  const { data: participants } = await supabase
    .from("room_participants")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });

  // Read from room_questions snapshot — open RLS, accessible to host and guests alike
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

  return (
    <RoomClient
      initialRoom={room}
      initialParticipants={participants ?? []}
      initialQuestions={sanitized}
      myParticipantId={myParticipant.id}
      isHost={room.host_user_id === user.id}
    />
  );
}
