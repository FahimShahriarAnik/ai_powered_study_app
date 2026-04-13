"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { TopicAccuracyPoint } from "@/lib/analytics/aggregations";

interface Props {
  data: TopicAccuracyPoint[];
}

function getBarColor(accuracy: number): string {
  if (accuracy >= 0.8) return "hsl(var(--chart-2, 142 76% 36%))";
  if (accuracy >= 0.5) return "hsl(var(--chart-4, 48 96% 53%))";
  return "hsl(var(--chart-1, 0 84% 60%))";
}

export function TopicAccuracyChart({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    accuracyPct: Math.round(d.accuracy * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="hsl(var(--border))"
        />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="topic"
          width={110}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))" }}
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            fontSize: 12,
          }}
          formatter={(value, _name, entry) => [
            `${value ?? 0}% (${(entry.payload as (TopicAccuracyPoint & { accuracyPct: number }) | undefined)?.correct ?? 0}/${(entry.payload as (TopicAccuracyPoint & { accuracyPct: number }) | undefined)?.total ?? 0})`,
            "Accuracy",
          ]}
        />
        <Bar dataKey="accuracyPct" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={getBarColor(entry.accuracy)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
