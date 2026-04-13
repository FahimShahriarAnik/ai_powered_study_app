"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { RollingAccuracyPoint } from "@/lib/analytics/aggregations";

interface Props {
  data: RollingAccuracyPoint[];
}

export function RollingAccuracyChart({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    accuracyPct: Math.round(d.accuracy * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart
        data={chartData}
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            fontSize: 12,
          }}
          formatter={(value) => [`${value ?? 0}%`, "Accuracy"]}
        />
        <ReferenceLine
          y={70}
          stroke="hsl(var(--border))"
          strokeDasharray="4 2"
          label={{ value: "70%", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
        />
        <Line
          type="monotone"
          dataKey="accuracyPct"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 4, fill: "hsl(var(--primary))" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
