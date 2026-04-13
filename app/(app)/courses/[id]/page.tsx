import { MaterialCard } from "@/components/courses/material-card";
import { UploadMaterialDialog } from "@/components/courses/upload-material-dialog";
import { createClient } from "@/lib/supabase/server";
import type { QuizWithQuestions } from "@/types/database";
import { BookOpen } from "lucide-react";
import { notFound } from "next/navigation";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (!course) notFound();

  const { data: materials } = await supabase
    .from("materials")
    .select("*")
    .eq("course_id", id)
    .order("created_at", { ascending: false });

  const materialList = materials ?? [];

  // Fetch all quizzes + questions for this course's materials in one go
  const materialIds = materialList.map((m) => m.id);
  let quizzesByMaterial: Record<string, QuizWithQuestions[]> = {};

  if (materialIds.length > 0) {
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("*, questions(*)")
      .in("material_id", materialIds)
      .order("created_at", { ascending: false });

    if (quizzes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const quiz of quizzes as any[]) {
        const mid = quiz.material_id as string;
        if (!quizzesByMaterial[mid]) quizzesByMaterial[mid] = [];
        const sorted = [...(quiz.questions as QuizWithQuestions["questions"])].sort(
          (a, b) => a.position - b.position
        );
        quizzesByMaterial[mid].push({ ...quiz, questions: sorted } as QuizWithQuestions);
      }
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {course.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {materialList.length} / 10 materials
          </p>
        </div>
        {materialList.length < 10 && (
          <UploadMaterialDialog courseId={course.id} />
        )}
      </div>

      {materialList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No materials yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a PDF or paste text to get started
          </p>
          <div className="mt-4">
            <UploadMaterialDialog courseId={course.id} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {materialList.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              quizzes={quizzesByMaterial[material.id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
