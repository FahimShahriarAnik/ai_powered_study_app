import { createClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/rag/chunker";
import { google } from "@ai-sdk/google";
import { embedMany } from "ai";
import { NextRequest, NextResponse } from "next/server";

// gemini-embedding-001: stable, 3072-dim
const EMBEDDING_MODEL = google.textEmbeddingModel("gemini-embedding-001");

const MAX_TEXT_CHARS = 15_000; // per material
const CHUNK_SIZE = 1_500;
const CHUNK_OVERLAP = 150;

// Micro-batch: send N chunks per API call, wait between batches.
// Avoids both timeout (sequential 1-by-1) and quota spikes (single giant batch).
const BATCH_SIZE = 10;   // chunks per embedMany call
const BATCH_DELAY_MS = 1_200; // ms between batches — ~50 RPM ceiling

export const maxDuration = 60;

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
 * Body: { courseId: string; materialIds?: string[] }
 * If materialIds provided, only those materials are embedded (saves API quota).
 * Otherwise all course materials are embedded.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId, materialIds } = (await request.json()) as {
    courseId: string;
    materialIds?: string[];
  };
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

  let query = supabase
    .from("materials")
    .select("id, title, raw_text")
    .eq("course_id", courseId);
  if (materialIds && materialIds.length > 0) {
    query = query.in("id", materialIds);
  }
  const { data: materials } = await query;

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

  // Micro-batch embed: N chunks per call, delay between batches.
  // Sequential 1-by-1 timeouts on Vercel; a single giant batch spikes quota.
  const embeddings: number[][] = [];
  try {
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      if (i > 0) await sleep(BATCH_DELAY_MS);
      const batch = allChunks.slice(i, i + BATCH_SIZE).map((c) => c.content);
      const { embeddings: batchEmbeddings } = await embedMany({
        model: EMBEDDING_MODEL,
        values: batch,
      });
      embeddings.push(...batchEmbeddings);
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

  // Delete old chunks for the materials being re-embedded (not the whole course)
  const materialIdsToDelete = allChunks
    .map((c) => c.material_id)
    .filter((v, i, a) => a.indexOf(v) === i);
  await supabase
    .from("material_chunks")
    .delete()
    .in("material_id", materialIdsToDelete);

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
