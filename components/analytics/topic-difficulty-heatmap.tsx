"use client";

import type { HeatmapCell } from "@/lib/analytics/aggregations";
import { cn } from "@/lib/utils";

interface Props {
  topics: string[];
  cells: HeatmapCell[];
}

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

function accuracyToColorClass(accuracy: number | null): string {
  if (accuracy === null) return "bg-muted text-muted-foreground";
  if (accuracy >= 0.8) return "bg-emerald-500/80 text-white";
  if (accuracy >= 0.6) return "bg-emerald-400/60 text-foreground";
  if (accuracy >= 0.4) return "bg-yellow-400/70 text-foreground";
  if (accuracy >= 0.2) return "bg-orange-400/70 text-white";
  return "bg-red-500/80 text-white";
}

export function TopicDifficultyHeatmap({ topics, cells }: Props) {
  const cellMap = new Map<string, HeatmapCell>(
    cells.map((c) => [`${c.topic}|${c.difficulty}`, c])
  );

  if (topics.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No data yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 text-muted-foreground font-medium w-40">
              Topic
            </th>
            {DIFFICULTIES.map((d) => (
              <th
                key={d}
                className="px-3 py-2 text-center text-muted-foreground font-medium capitalize"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {topics.map((topic) => (
            <tr key={topic} className="border-t border-border">
              <td className="px-3 py-2 text-foreground font-medium truncate max-w-[10rem]">
                {topic}
              </td>
              {DIFFICULTIES.map((diff) => {
                const cell = cellMap.get(`${topic}|${diff}`);
                const accuracy = cell?.total ? cell.accuracy : null;
                return (
                  <td key={diff} className="px-2 py-1">
                    <div
                      className={cn(
                        "rounded px-2 py-1.5 text-center font-medium transition-colors",
                        accuracyToColorClass(accuracy)
                      )}
                      title={
                        accuracy !== null && cell
                          ? `${cell.correct}/${cell.total} correct (${Math.round(accuracy * 100)}%)`
                          : "No data"
                      }
                    >
                      {accuracy !== null
                        ? `${Math.round(accuracy * 100)}%`
                        : "—"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
