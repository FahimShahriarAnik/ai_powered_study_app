import { createClient } from "@/lib/supabase/server";
import { RoomsHub } from "./rooms-hub";

export default async function RoomsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load user's quizzes (with material title for display)
  const { data: courses } = await supabase
    .from("courses")
    .select("id, name")
    .order("created_at", { ascending: false });

  const courseIds = (courses ?? []).map((c) => c.id);
  const courseMap = Object.fromEntries(
    (courses ?? []).map((c) => [c.id, c.name])
  );

  const materialsData =
    courseIds.length > 0
      ? await supabase
          .from("materials")
          .select("id, course_id, title")
          .in("course_id", courseIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const materialIds = (materialsData.data ?? []).map((m) => m.id);
  const materialMap = Object.fromEntries(
    (materialsData.data ?? []).map((m) => [m.id, { title: m.title, courseId: m.course_id }])
  );

  const quizzesData =
    materialIds.length > 0
      ? await supabase
          .from("quizzes")
          .select("id, material_id, title, question_count, difficulty")
          .in("material_id", materialIds)
          .gt("question_count", 0)
          .order("created_at", { ascending: false })
      : { data: [] };

  const quizOptions = (quizzesData.data ?? []).map((q) => {
    const mat = materialMap[q.material_id];
    const courseName = mat ? courseMap[mat.courseId] : "";
    return {
      id: q.id,
      label: `${q.title}${courseName ? ` · ${courseName}` : ""}`,
      questionCount: q.question_count,
      difficulty: q.difficulty,
    };
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Quiz Rooms
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Challenge a friend to a live competitive quiz
        </p>
      </div>
      <RoomsHub quizOptions={quizOptions} userId={user?.id ?? ""} />
    </div>
  );
}
