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
    teal: "from-[#0b3b6f] via-[#0e7cc7] to-[#7dd3fc]",
    emerald: "from-[#0d5f52] via-[#10b981] to-[#9ff4cf]",
    sand: "from-[#7a341b] via-[#f97316] to-[#fed7aa]",
    ink: "from-[#111827] via-[#1f2937] to-[#9ca3af]"
  } satisfies Record<string, string>;
  const accentIconStyles = {
    teal: "bg-cyan-200/28 text-cyan-50",
    emerald: "bg-emerald-200/28 text-emerald-50",
    sand: "bg-orange-200/28 text-orange-50",
    ink: "bg-slate-200/28 text-slate-50"
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
    <Card className={`group relative space-y-3 overflow-hidden border-white/45 bg-gradient-to-br p-4 text-white shadow-[0_14px_32px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.14)] sm:p-5 ${accentStyles[accent]}`}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/12 blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-white/70">{label}</p>
        <div className="flex items-center gap-2">
          {comparison ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${comparisonTone}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              {comparison.deltaPct >= 0 ? "+" : ""}
              {comparison.deltaPct.toFixed(1)}%
            </span>
          ) : null}
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${accentIconStyles[accent]}`}>
            <TrendIcon className="h-3.5 w-3.5" />
          </span>
        </div>
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
