"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

// Brand orange first, then complementary muted tones.
const COLORS = ["#f4511e", "#1e5af4", "#0f9d58", "#f4b400", "#71717a", "#9c27b0"];

export type ReferralSlice = { name: string; capital: number; investors: number };

export function ReferralPieChart({ data }: { data: ReferralSlice[] }) {
  if (!data.length) {
    return <p className="py-10 text-center text-sm text-zinc-400">No data yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="capital"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={85}
          label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
        >
          {data.map((slice, i) => (
            <Cell key={slice.name} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, _name, item) => [
            `${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })} (${item?.payload?.investors} investor${item?.payload?.investors === 1 ? "" : "s"})`,
            "Capital raised",
          ]}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
