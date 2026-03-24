import { BetaNotice } from "@/components/ui/beta-notice";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

export default function GastosVariablesPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Operación diaria"
        title="Gastos variables"
        description="Registra gastos variables y míralos agrupados por categoría, negocio y período."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Por categoría</h3>
          <BetaNotice description="El desglose real por categoría ya existe en dashboard; esta vista dedicada está en etapa beta para evitar duplicidad de datos sin contexto." />
        </Card>
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Por unidad de negocio</h3>
          <BetaNotice description="Pronto verás esta vista conectada directamente a analytics por workspace, sin montos de demostración." />
        </Card>
      </div>
    </div>
  );
}
