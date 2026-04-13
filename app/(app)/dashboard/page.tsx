import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FileText, Plus, Zap } from "lucide-react";
import Link from "next/link";

const MOCK_COURSES = [
  {
    id: "1",
    name: "Introduction to Statistics",
    materialCount: 4,
    quizCount: 7,
    lastActivity: "2 hours ago",
    topics: ["Probability", "Distributions", "Hypothesis Testing"],
  },
  {
    id: "2",
    name: "Data Structures & Algorithms",
    materialCount: 2,
    quizCount: 3,
    lastActivity: "Yesterday",
    topics: ["Arrays", "Trees", "Sorting"],
  },
  {
    id: "3",
    name: "Financial Accounting",
    materialCount: 6,
    quizCount: 12,
    lastActivity: "3 days ago",
    topics: ["Balance Sheet", "Income Statement", "Cash Flow"],
  },
  {
    id: "4",
    name: "Microeconomics",
    materialCount: 3,
    quizCount: 5,
    lastActivity: "1 week ago",
    topics: ["Supply & Demand", "Elasticity", "Market Structures"],
  },
  {
    id: "5",
    name: "Machine Learning Fundamentals",
    materialCount: 1,
    quizCount: 0,
    lastActivity: "Just added",
    topics: ["Supervised Learning", "Neural Networks"],
  },
];

export default function DashboardPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your courses and study progress
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          New Course
        </Button>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Courses", value: "5", icon: BookOpen },
          { label: "Materials", value: "16", icon: FileText },
          { label: "Quizzes taken", value: "27", icon: Zap },
          { label: "Avg. score", value: "74%", icon: Zap },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {value}
            </p>
          </Card>
        ))}
      </div>

      {/* Courses grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_COURSES.map((course) => (
          <Link key={course.id} href={`/courses/${course.id}`}>
            <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug">
                  {course.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {course.lastActivity}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {course.materialCount} materials
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" />
                    {course.quizCount} quizzes
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {course.topics.slice(0, 3).map((topic) => (
                    <Badge key={topic} variant="secondary" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Add course card */}
        <Card className="flex cursor-pointer items-center justify-center border-dashed p-6 transition-colors hover:bg-muted/50">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Plus className="h-8 w-8" />
            <span className="text-sm font-medium">Add a course</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
