"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters/currency";

const palette = ["#0f3d3e", "#2d6a6a", "#d8c3a5", "#8f684d", "#b7d9cf"];

export function BarChartCard({
  title,
  data,
  dataKey = "value"
}: {
  title: string;
  data: Array<Record<string, string | number>>;
  dataKey?: string;
}) {
  return (
    <Card className="h-[320px]">
      <h3 className="mb-5 text-lg font-semibold">{title}</h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eadfce" />
          <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
          <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => formatCurrency(Number(v))} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Bar dataKey={dataKey} radius={[12, 12, 0, 0]} fill="#0f3d3e" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function LineChartCard({
  title,
  data,
  description
}: {
  title: string;
  data: Array<Record<string, string | number>>;
  description?: string;
}) {
  return (
    <Card className="h-[320px] rounded-[28px] border border-white/75 bg-gradient-to-br from-white/92 to-cyan-50/55 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.07)] sm:p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h3>
        {description ? <p className="mt-1 text-xs text-neutral-500 sm:text-sm">{description}</p> : null}
      </div>
      <ResponsiveContainer width="100%" height="86%">
        <LineChart data={data}>
          <defs>
            <linearGradient id="incomeStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.92} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.92} />
            </linearGradient>
            <linearGradient id="expenseStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#fb7185" stopOpacity={0.9} />
            </linearGradient>
            <linearGradient id="netStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#334155" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#0f172a" stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e5e7eb" opacity={0.55} />
          <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCurrency(Number(v))}
          />
          <Tooltip
            cursor={{ stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "4 4" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(226,232,240,0.9)",
              boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
              background: "rgba(255,255,255,0.96)"
            }}
            formatter={(value: number) => formatCurrency(value)}
          />
          <Legend wrapperStyle={{ fontSize: "11px", color: "#64748b", paddingTop: "8px" }} />
          <Line
            type="monotone"
            dataKey="ingresos"
            stroke="url(#incomeStroke)"
            strokeWidth={2.7}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "#0f766e" }}
            isAnimationActive
            animationDuration={650}
          />
          <Line
            type="monotone"
            dataKey="egresos"
            stroke="url(#expenseStroke)"
            strokeWidth={2.7}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "#ea580c" }}
            isAnimationActive
            animationDuration={760}
          />
          <Line
            type="monotone"
            dataKey="neto"
            stroke="url(#netStroke)"
            strokeWidth={2.1}
            dot={false}
            strokeDasharray="5 4"
            activeDot={{ r: 4, strokeWidth: 0, fill: "#111827" }}
            isAnimationActive
            animationDuration={880}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function ComparisonBarChartCard({
  title,
  data,
  description
}: {
  title: string;
  data: Array<Record<string, string | number>>;
  description?: string;
}) {
  return (
    <Card className="h-[320px]">
      <div className="mb-5">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-sm text-neutral-500">{description}</p> : null}
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} barGap={10}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eadfce" />
          <XAxis dataKey="label" stroke="#6b7280" fontSize={12} />
          <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => formatCurrency(Number(v))} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
          <Bar dataKey="previous" name="Periodo anterior" radius={[10, 10, 0, 0]} fill="#cbd5e1" />
          <Bar dataKey="current" name="Periodo actual" radius={[10, 10, 0, 0]} fill="#0f3d3e" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function PieChartCard({
  title,
  data,
  valueFormatter = (value: number) => `${value}%`
}: {
  title: string;
  data: Array<Record<string, string | number>>;
  valueFormatter?: (value: number) => string;
}) {
  return (
    <Card className="h-[320px]">
      <h3 className="mb-5 text-lg font-semibold">{title}</h3>
      <ResponsiveContainer width="100%" height="85%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={4}>
            {data.map((entry, index) => (
              <Cell
                key={`${String(entry.name)}-${index}`}
                fill={palette[index % palette.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => valueFormatter(value)} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
