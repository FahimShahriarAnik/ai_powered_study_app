import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
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

  const { data: room } = await supabase
    .from("quiz_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.host_user_id !== user.id) {
    return NextResponse.json({ error: "Only the host can start" }, { status: 403 });
  }
  if (room.status !== "waiting") {
    return NextResponse.json({ error: "Game already started" }, { status: 409 });
  }

  // Check at least 1 participant (can start solo for testing)
  const { count } = await supabase
    .from("room_participants")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);

  if ((count ?? 0) === 0) {
    return NextResponse.json({ error: "No participants" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("quiz_rooms")
    .update({
      status: "active",
      current_question: 0,
      question_started_at: now,
    })
    .eq("id", roomId);

  if (error) {
    return NextResponse.json({ error: "Failed to start game" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
