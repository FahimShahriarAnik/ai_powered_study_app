import { NewCourseDialog } from "@/components/dashboard/new-course-dialog";
import { SmartQuizDialog } from "@/components/quiz/smart-quiz-dialog";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/types/database";
import { BookOpen, FileText, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  const courseList: Course[] = courses ?? [];
  const showNewDialog = params.new === "1";

  // Wire up real counts
  const courseIds = courseList.map((c) => c.id);
  const [materialsResult, attemptsResult] = await Promise.all([
    courseIds.length > 0
      ? supabase
          .from("materials")
          .select("id", { count: "exact", head: true })
          .in("course_id", courseIds)
      : Promise.resolve({ count: 0 }),
    user
      ? supabase
          .from("quiz_attempts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .not("completed_at", "is", null)
      : Promise.resolve({ count: 0 }),
  ]);
  const materialsCount = materialsResult.count ?? 0;
  const quizzesTakenCount = attemptsResult.count ?? 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your courses and study progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SmartQuizDialog />
          <NewCourseDialog open={showNewDialog} />
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Courses", value: courseList.length },
          { label: "Materials", value: materialsCount },
          { label: "Quizzes taken", value: quizzesTakenCount },
        ].map(({ label, value }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {value}
            </p>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {courseList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No courses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first course to get started
          </p>
          <NewCourseDialog triggerLabel="Create course" className="mt-4" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courseList.map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base leading-snug">
                    {course.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(course.created_at).toLocaleDateString()}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />0 materials
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5" />0 quizzes
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {/* Add course card */}
          <Link href="/dashboard?new=1">
            <Card className="flex h-full min-h-[120px] cursor-pointer items-center justify-center border-dashed transition-colors hover:bg-muted/50">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Plus className="h-8 w-8" />
                <span className="text-sm font-medium">Add a course</span>
              </div>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
