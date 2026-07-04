"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

export type VehicleBarDatum = { name: string; capital: number; currentValue: number };

function compact(value: number) {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function VehicleBarChart({ data }: { data: VehicleBarDatum[] }) {
  if (!data.length) {
    return <p className="py-10 text-center text-sm text-zinc-400">No data yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          tickFormatter={(name: string) => (name.length > 22 ? `${name.slice(0, 20)}…` : name)}
        />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={compact} width={52} />
        <Tooltip
          formatter={(value) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="capital" name="Total capital (paid in)" fill="#71717a" radius={[3, 3, 0, 0]} />
        <Bar dataKey="currentValue" name="Current value" fill="#f4511e" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
