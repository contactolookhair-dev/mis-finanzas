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
    <Card className={`space-y-3 overflow-hidden border-white/45 bg-gradient-to-br p-4 text-white shadow-[0_14px_32px_rgba(15,23,42,0.08)] sm:p-5 ${accentStyles[accent]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-white/70">{label}</p>
        {comparison ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${comparisonTone}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            {comparison.deltaPct >= 0 ? "+" : ""}
            {comparison.deltaPct.toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <p className="text-[1.45rem] font-semibold tracking-tight sm:text-[1.6rem]">{formatCurrency(value)}</p>
        <p className="mt-1 text-xs text-white/75 sm:text-sm">{detail}</p>
        {comparison ? (
          <p className="text-[11px] text-white/72">
            {comparison.previousLabel ? `Vs ${comparison.previousLabel}` : "Vs periodo anterior"}:{" "}
            {comparison.delta >= 0 ? "+" : ""}
            {formatCurrency(comparison.delta)}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
