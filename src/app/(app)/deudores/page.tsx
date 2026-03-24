import { DebtorForm } from "@/components/forms/debtor-form";
import { BetaNotice } from "@/components/ui/beta-notice";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

export default function DeudoresPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Cuentas por cobrar"
        title="Personas que me deben"
        description="Seguimiento de préstamos, anticipos y saldos por cobrar con historial preparado para abonos."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Resumen de cobranzas</h3>
          <BetaNotice description="Este resumen se conectará al historial real de deudores por workspace. Quitamos cifras de ejemplo para mantener confianza operativa." />
        </Card>
        <DebtorForm />
      </div>
    </div>
  );
}
