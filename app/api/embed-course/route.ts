import { createClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/rag/chunker";
import { google } from "@ai-sdk/google";
import { embed } from "ai";
import { NextRequest, NextResponse } from "next/server";

// gemini-embedding-001: stable, 3072-dim, supports embedContent (not batchEmbedContents)
const EMBEDDING_MODEL = google.textEmbeddingModel("gemini-embedding-001");

// Larger chunks → fewer API calls → fewer 429s on free-tier RPM limits
const MAX_TEXT_CHARS = 15_000; // per material
const CHUNK_SIZE = 1_500;      // ~1 API call per 1500 chars
const CHUNK_OVERLAP = 150;
const DELAY_MS = 500;          // wait between each embed call to stay under ~5 RPM

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * GET /api/embed-course?courseId=X
 * Returns { hasEmbeddings: boolean, chunkCount: number }
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courseId = request.nextUrl.searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "courseId required" }, { status: 400 });
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .single();
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { count } = await supabase
    .from("material_chunks")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  return NextResponse.json({
    hasEmbeddings: (count ?? 0) > 0,
    chunkCount: count ?? 0,
  });
}

/**
 * POST /api/embed-course
 * Body: { courseId: string }
 * Chunks all materials, embeds sequentially with rate-limit delay, upserts into material_chunks.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = (await request.json()) as { courseId: string };
  if (!courseId) {
    return NextResponse.json({ error: "courseId required" }, { status: 400 });
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", courseId)
    .single();
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, raw_text")
    .eq("course_id", courseId);

  if (!materials || materials.length === 0) {
    return NextResponse.json(
      { error: "No materials found for this course" },
      { status: 400 }
    );
  }

  // Build chunks
  const allChunks: {
    material_id: string;
    course_id: string;
    content: string;
    chunk_index: number;
  }[] = [];

  for (const material of materials) {
    const truncated = material.raw_text.slice(0, MAX_TEXT_CHARS);
    const chunks = chunkText(truncated, CHUNK_SIZE, CHUNK_OVERLAP);
    chunks.forEach((content, idx) => {
      allChunks.push({
        material_id: material.id,
        course_id: courseId,
        content,
        chunk_index: idx,
      });
    });
  }

  if (allChunks.length === 0) {
    return NextResponse.json(
      { error: "No text content to embed" },
      { status: 400 }
    );
  }

  console.log(
    `[embed-course] "${course.name}" — ${materials.length} materials, ${allChunks.length} chunks`
  );

  // Sequential embed with delay to respect free-tier RPM limits (~5 RPM)
  const embeddings: number[][] = [];
  try {
    for (let i = 0; i < allChunks.length; i++) {
      if (i > 0) await sleep(DELAY_MS);
      const { embedding } = await embed({
        model: EMBEDDING_MODEL,
        value: allChunks[i].content,
      });
      embeddings.push(embedding);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Embedding failed";
    console.error("[embed-course] Embedding error:", msg);
    // Surface 429 clearly so the UI can show a useful message
    const status = msg.includes("429") || msg.toLowerCase().includes("quota") ? 429 : 500;
    return NextResponse.json(
      { error: status === 429 ? "Rate limit hit — wait 60 s and try again." : msg },
      { status }
    );
  }

  // Delete old chunks then insert fresh
  await supabase.from("material_chunks").delete().eq("course_id", courseId);

  const rows = allChunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i] as unknown as number[],
  }));

  const { error: insertError } = await supabase
    .from("material_chunks")
    .insert(rows);

  if (insertError) {
    console.error("[embed-course] Insert error:", insertError.message);
    return NextResponse.json(
      { error: "Failed to save embeddings" },
      { status: 500 }
    );
  }

  console.log(`[embed-course] Done — ${rows.length} chunks saved`);
  return NextResponse.json({ chunksCreated: rows.length });
}
