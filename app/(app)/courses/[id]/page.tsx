import { MaterialCard } from "@/components/courses/material-card";
import { UploadMaterialDialog } from "@/components/courses/upload-material-dialog";
import { CourseChatSheet } from "@/components/chat/course-chat-sheet";
import { createClient } from "@/lib/supabase/server";
import type { QuizAttempt, QuizWithAttempts } from "@/types/database";
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

  const materialIds = materialList.map((m) => m.id);
  const quizzesByMaterial: Record<string, QuizWithAttempts[]> = {};

  if (materialIds.length > 0) {
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("*, questions(*)")
      .in("material_id", materialIds)
      .order("created_at", { ascending: false });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quizIds = ((quizzes ?? []) as any[]).map((q) => q.id as string);

    let attemptsByQuiz: Record<string, QuizAttempt[]> = {};
    if (quizIds.length > 0) {
      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("*")
        .in("quiz_id", quizIds)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });

      attemptsByQuiz = ((attempts ?? []) as QuizAttempt[]).reduce(
        (acc, a) => {
          (acc[a.quiz_id] ??= []).push(a);
          return acc;
        },
        {} as Record<string, QuizAttempt[]>
      );
    }

    if (quizzes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const quiz of quizzes as any[]) {
        const mid = quiz.material_id as string;
        (quizzesByMaterial[mid] ??= []);
        const sorted = [
          ...(quiz.questions as QuizWithAttempts["questions"]),
        ].sort((a, b) => a.position - b.position);
        quizzesByMaterial[mid].push({
          ...quiz,
          questions: sorted,
          attempts: attemptsByQuiz[quiz.id] ?? [],
        } as QuizWithAttempts);
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
        <div className="flex items-center gap-2">
          {materialList.length > 0 && (
            <CourseChatSheet courseId={course.id} courseName={course.name} />
          )}
          {materialList.length < 10 && (
            <UploadMaterialDialog courseId={course.id} />
          )}
        </div>
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
              courseId={course.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
