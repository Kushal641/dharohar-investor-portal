"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export type NavPoint = { date: string; nav: number };

export function NavLineChart({ data }: { data: NavPoint[] }) {
  if (data.length < 2) return null;
  return (
    <div className="mt-6 rounded-md border border-zinc-100 p-4">
      <p className="text-xs font-medium text-zinc-600">NAV per Unit</p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => v.toFixed(2)}
            width={56}
          />
          <Tooltip formatter={(value) => [Number(value).toFixed(6), "NAV per unit"]} />
          <Line
            type="monotone"
            dataKey="nav"
            stroke="#f4511e"
            strokeWidth={2}
            dot={{ r: 4, fill: "#f4511e" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
