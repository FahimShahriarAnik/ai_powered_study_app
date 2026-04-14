import { createServerClient } from "@supabase/ssr";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/types/database";

const MAX_TEXT_CHARS = 15_000;

const flashcardSchema = z.object({
  title: z.string().describe("Short descriptive title for this flashcard set, e.g. 'Key Concepts — Chapter 3'"),
  cards: z
    .array(
      z.object({
        front: z.string().describe("Term, concept, or short question (1 sentence max)"),
        back: z.string().describe("Definition, explanation, or answer (2-4 sentences)"),
      })
    )
    .min(5)
    .max(20),
});

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { materialId } = (await request.json()) as { materialId: string };
  if (!materialId) {
    return NextResponse.json({ error: "materialId is required" }, { status: 400 });
  }

  const { data: material } = await supabase
    .from("materials")
    .select("id, title, raw_text, course_id")
    .eq("id", materialId)
    .single();

  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  const rawText = material.raw_text.slice(0, MAX_TEXT_CHARS);

  let result: Awaited<ReturnType<typeof generateObject<typeof flashcardSchema>>>;
  try {
    result = await generateObject({
      model: google("gemini-3-flash-preview"),
      schema: flashcardSchema,
      prompt: `You are an expert study assistant. Generate 10–15 flashcards from the study material below.

Rules:
- front: a key term, concept name, or short question (concise — max 1 sentence)
- back: clear definition or answer (2–4 sentences, plain language)
- Cover the most important concepts, vocabulary, and ideas from the material
- No duplicate cards
- Base cards strictly on the provided material

Study material — "${material.title}":
${rawText}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { title, cards } = result.object;

  // Save flashcard set
  const { data: set, error: setError } = await supabase
    .from("flashcard_sets")
    .insert({
      user_id: user.id,
      material_id: materialId,
      title,
    })
    .select()
    .single();

  if (setError || !set) {
    return NextResponse.json({ error: "Failed to save flashcard set" }, { status: 500 });
  }

  // Save individual cards
  const { error: cardsError } = await supabase.from("flashcards").insert(
    cards.map((card, i) => ({
      set_id: set.id,
      front: card.front,
      back: card.back,
      sort_order: i,
    }))
  );

  if (cardsError) {
    return NextResponse.json({ error: "Failed to save flashcards" }, { status: 500 });
  }

  return NextResponse.json({ setId: set.id, title, cardCount: cards.length });
}
