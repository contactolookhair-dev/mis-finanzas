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
    <Card className="h-[320px]">
      <div className="mb-5">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-sm text-neutral-500">{description}</p> : null}
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eadfce" />
          <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
          <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => formatCurrency(Number(v))} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
          <Line type="monotone" dataKey="ingresos" stroke="#0f766e" strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="egresos" stroke="#b45309" strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="neto" stroke="#1f2937" strokeWidth={2.5} dot={false} strokeDasharray="6 4" />
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
