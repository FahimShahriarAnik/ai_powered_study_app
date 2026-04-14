import { StudyClient } from "./study-client";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { FlashcardSetWithCards } from "@/types/database";

export default async function MaterialStudyPage({
  params,
}: {
  params: Promise<{ id: string; materialId: string }>;
}) {
  const { id: courseId, materialId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: material }, { data: course }] = await Promise.all([
    supabase.from("materials").select("*").eq("id", materialId).single(),
    supabase.from("courses").select("id, name").eq("id", courseId).single(),
  ]);

  if (!material || !course) notFound();

  // Fetch existing note for this user + material
  const { data: noteRow } = user
    ? await supabase
        .from("material_notes")
        .select("content")
        .eq("user_id", user.id)
        .eq("material_id", materialId)
        .maybeSingle()
    : { data: null };

  // Fetch existing flashcard sets with their cards
  const { data: rawSets } = user
    ? await supabase
        .from("flashcard_sets")
        .select("*, flashcards(*)")
        .eq("user_id", user.id)
        .eq("material_id", materialId)
        .order("created_at", { ascending: false })
    : { data: null };

  const flashcardSets: FlashcardSetWithCards[] = ((rawSets ?? []) as FlashcardSetWithCards[]).map(
    (s) => ({
      ...s,
      flashcards: [...s.flashcards].sort((a, b) => a.sort_order - b.sort_order),
    })
  );

  return (
    <StudyClient
      material={material}
      courseName={course.name}
      courseId={courseId}
      initialNote={noteRow?.content ?? ""}
      initialFlashcardSets={flashcardSets}
    />
  );
}
