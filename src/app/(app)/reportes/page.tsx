import { ExportActions } from "@/components/exports/export-actions";
import { BetaNotice } from "@/components/ui/beta-notice";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

export default function ReportesPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Análisis filtrable"
        title="Reportes"
        description="Resumen preparado para filtros por fecha y unidad, con foco en flujo neto, reembolsos y cuentas por cobrar."
      />

      <ExportActions filters={{}} defaultReportType="financial_period" />

      <BetaNotice description="Los KPIs de reportes se moverán a una versión 100% conectada a filtros persistentes por usuario. Quitamos tarjetas con montos demo para mantener confianza en el dato." />

      <Card className="space-y-4">
        <h3 className="text-lg font-semibold">Reportes listos para crecer</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            "Gastos fijos vs variables",
            "Personal vs empresa",
            "Dinero personal puesto en negocios",
            "Evolución mensual",
            "Cuentas por cobrar",
            "Gastos por categoría"
          ].map((item) => (
            <div key={item} className="rounded-[24px] bg-muted/70 p-4 text-sm">
              {item}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
