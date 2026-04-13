"use client";

import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

interface Props {
  completedCount: number;
  required?: number;
}

const REQUIRED = 3;

export function AnalyticsEmptyState({ completedCount, required = REQUIRED }: Props) {
  const progress = Math.min(completedCount, required);

  return (
    <Card className="mx-auto max-w-md mt-16">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="rounded-full bg-muted p-4">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Not enough data yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete {required} quizzes to unlock your analytics dashboard.
          </p>
        </div>
        <div className="w-full">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>
              {progress} / {required}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(progress / required) * 100}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
