import { createClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/rag/chunker";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embedMany } from "ai";
import { NextRequest, NextResponse } from "next/server";

// text-embedding-004 is only available on the v1 endpoint (not v1beta)
const googleV1 = createGoogleGenerativeAI({
  baseURL: "https://generativelanguage.googleapis.com/v1",
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const MAX_TEXT_CHARS = 20_000; // per material — keeps embedding cost bounded
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;
const EMBED_BATCH_SIZE = 50; // Gemini batch limit safety margin

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

  // Verify course ownership
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .single();
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Count existing chunks
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
 * Chunks all materials in the course, embeds them with Gemini text-embedding-004,
 * and upserts into material_chunks. Idempotent — existing chunks are deleted first.
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

  // Verify course ownership
  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", courseId)
    .single();
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Fetch all materials
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

  // Build all chunks across all materials
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
    `[embed-course] course="${course.name}" — ${materials.length} materials, ${allChunks.length} chunks`
  );

  // Embed in batches
  const embeddings: number[][] = [];
  try {
    for (let i = 0; i < allChunks.length; i += EMBED_BATCH_SIZE) {
      const batch = allChunks.slice(i, i + EMBED_BATCH_SIZE);
      const { embeddings: batchEmbeddings } = await embedMany({
        model: googleV1.textEmbeddingModel("text-embedding-004"),
        values: batch.map((c) => c.content),
      });
      embeddings.push(...batchEmbeddings);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Embedding failed";
    console.error("[embed-course] Embedding error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Delete old chunks for this course (idempotent re-embed)
  await supabase.from("material_chunks").delete().eq("course_id", courseId);

  // Insert new chunks with embeddings
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

  console.log(
    `[embed-course] Done — ${rows.length} chunks embedded and saved for course ${courseId}`
  );

  return NextResponse.json({ chunksCreated: rows.length });
}
