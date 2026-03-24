import { BetaNotice } from "@/components/ui/beta-notice";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

export default function ReembolsosPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Fondos personales en empresas"
        title="Gastos empresariales pagados por mí"
        description="Visualiza aportes personales, estados de reembolso y exposición por unidad de negocio."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-neutral-500">Look Hair</p>
          <p className="mt-2 text-sm text-neutral-600">Conectando dato real</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-500">House of Hair</p>
          <p className="mt-2 text-sm text-neutral-600">Conectando dato real</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-500">Pendiente total</p>
          <p className="mt-2 text-sm text-neutral-600">Conectando dato real</p>
        </Card>
      </div>

      <Card className="space-y-4">
        <BetaNotice description="La lógica de reembolso automático ya está activa en backend. Esta vista aún está en beta mientras conectamos el listado real y estados por workspace." />
      </Card>
    </div>
  );
}
