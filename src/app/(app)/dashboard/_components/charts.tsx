"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" };

export function StaffLoadChart({ data }: { data: { name: string; open: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" allowDecimals={false} tick={AXIS} />
        <YAxis type="category" dataKey="name" width={72} tick={AXIS} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [`${value ?? 0}건`, "진행 중 업무"]}
        />
        <Bar dataKey="open" name="진행 중 업무" fill="var(--primary)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const STATUS_SEGMENTS = [
  { key: "pending", label: "대기", color: "#cbd5e1" },
  { key: "docs_received", label: "자료 수취", color: "#fbbf24" },
  { key: "filed", label: "신고 완료", color: "#60a5fa" },
  { key: "done", label: "완료", color: "#34d399" },
] as const;

export function FilingProgressChart({
  data,
}: {
  data: { label: string; pending: number; docs_received: number; filed: number; done: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS} interval={0} />
        <YAxis allowDecimals={false} tick={AXIS} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {STATUS_SEGMENTS.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
