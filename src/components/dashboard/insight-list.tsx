import { Card } from "@/components/ui/card";
import type { FinancialInsight } from "@/server/services/insights-service";

export function InsightList({ insights }: { insights: FinancialInsight[] }) {
  const severityStyles = {
    info: "border-sky-200 bg-sky-50",
    warning: "border-amber-200 bg-amber-50",
    critical: "border-rose-200 bg-rose-50"
  } as const;
  const severityLabels = {
    info: "Seguimiento",
    warning: "Atención",
    critical: "Crítico"
  } as const;

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Insights automáticos</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Alertas generadas con datos reales del workspace activo.
        </p>
      </div>
      <div className="space-y-3">
        {insights.length === 0 ? <p className="text-sm text-neutral-500">No hay alertas para este periodo.</p> : null}
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`rounded-[24px] border p-4 ${severityStyles[insight.severity]}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{insight.title}</p>
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                {severityLabels[insight.severity]}
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-600">{insight.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
