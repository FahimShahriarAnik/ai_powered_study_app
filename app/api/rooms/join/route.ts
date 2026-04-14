import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function extractDisplayName(email: string): string {
  return email.split("@")[0].replace(/[._-]/g, " ").slice(0, 20) || "Player";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = (await request.json()) as { code: string };
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const normalizedCode = code.trim().toUpperCase();

  // Find room by code
  const { data: room } = await supabase
    .from("quiz_rooms")
    .select("*")
    .eq("code", normalizedCode)
    .maybeSingle();

  if (!room) {
    return NextResponse.json(
      { error: "Room not found — check the code" },
      { status: 404 }
    );
  }

  if (room.status !== "waiting") {
    return NextResponse.json(
      { error: "Game already started or finished" },
      { status: 409 }
    );
  }

  // Check if already a participant
  const { data: existing } = await supabase
    .from("room_participants")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    // Already joined — return their participant id
    return NextResponse.json({ roomId: room.id, participantId: existing.id });
  }

  // Check participant cap (max 2 players for competitive mode)
  const { count } = await supabase
    .from("room_participants")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);

  if ((count ?? 0) >= 2) {
    return NextResponse.json({ error: "Room is full" }, { status: 409 });
  }

  // Join as participant
  const displayName = extractDisplayName(user.email ?? user.id);
  const { data: participant, error } = await supabase
    .from("room_participants")
    .insert({
      room_id: room.id,
      user_id: user.id,
      display_name: displayName,
      score: 0,
    })
    .select()
    .single();

  if (error || !participant) {
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }

  return NextResponse.json({ roomId: room.id, participantId: participant.id });
}
