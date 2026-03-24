import { Card } from "@/components/ui/card";
import type { FinancialInsight } from "@/server/services/insights-service";

export function InsightList({ insights }: { insights: FinancialInsight[] }) {
  const severityStyles = {
    info: "border-sky-100 bg-sky-50/70",
    warning: "border-amber-100 bg-amber-50/70",
    critical: "border-rose-100 bg-rose-50/75"
  } as const;
  const severityLabels = {
    info: "Seguimiento",
    warning: "Atención",
    critical: "Crítico"
  } as const;

  return (
    <Card className="space-y-4 rounded-[28px] border border-white/75 bg-white/88 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.07)] sm:p-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Insights automáticos</h3>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Alertas generadas con datos reales del workspace activo.
        </p>
      </div>
      <div className="space-y-2.5">
        {insights.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/65 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-600">Sin alertas críticas por ahora</p>
            <p className="mt-1 text-xs text-slate-500">La IA volverá a mostrar cambios relevantes cuando aparezcan.</p>
          </div>
        ) : null}
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`rounded-[22px] border p-3.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)] ${severityStyles[insight.severity]}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">{insight.title}</p>
              <span className="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                {severityLabels[insight.severity]}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-600 sm:text-sm">{insight.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
