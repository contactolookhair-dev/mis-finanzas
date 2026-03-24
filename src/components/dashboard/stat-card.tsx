import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters/currency";

export function StatCard({
  label,
  value,
  detail,
  accent = "teal",
  comparison
}: {
  label: string;
  value: number;
  detail: string;
  accent?: "teal" | "emerald" | "sand" | "ink";
  comparison?: {
    delta: number;
    deltaPct: number;
    previousLabel?: string;
    invertTrend?: boolean;
  };
}) {
  const accentStyles = {
    teal: "from-[#0f3d3e] via-[#1e5f61] to-[#7fc7b5]",
    emerald: "from-[#0b5d46] via-[#0f8a68] to-[#d7f3e7]",
    sand: "from-[#7b4f2e] via-[#b07a44] to-[#f2dfc2]",
    ink: "from-[#111827] via-[#334155] to-[#dbe4f0]"
  } satisfies Record<string, string>;

  const isNeutral = !comparison || Math.abs(comparison.delta) < 0.005;
  const isPositive = comparison
    ? comparison.invertTrend
      ? comparison.delta <= 0
      : comparison.delta >= 0
    : true;
  const TrendIcon = isNeutral ? Minus : isPositive ? ArrowUpRight : ArrowDownRight;
  const comparisonTone = isNeutral
    ? "bg-white/12 text-white/80"
    : isPositive
      ? "bg-emerald-100/18 text-emerald-50"
      : "bg-amber-100/18 text-amber-50";

  return (
    <Card className={`space-y-3 overflow-hidden bg-gradient-to-br text-white ${accentStyles[accent]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-white/72">{label}</p>
        {comparison ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${comparisonTone}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            {comparison.deltaPct >= 0 ? "+" : ""}
            {comparison.deltaPct.toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div className="space-y-2">
        <p className="text-2xl font-semibold tracking-tight">{formatCurrency(value)}</p>
        <p className="mt-1 text-sm text-white/72">{detail}</p>
        {comparison ? (
          <p className="text-xs text-white/72">
            {comparison.previousLabel ? `Vs ${comparison.previousLabel}` : "Vs periodo anterior"}:{" "}
            {comparison.delta >= 0 ? "+" : ""}
            {formatCurrency(comparison.delta)}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
