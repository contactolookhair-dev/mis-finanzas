import { FixedExpenseForm } from "@/components/forms/fixed-expense-form";
import { BetaNotice } from "@/components/ui/beta-notice";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

export default function GastosFijosPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Compromisos recurrentes"
        title="Gastos fijos"
        description="Administra vencimientos, responsables y cuentas asociadas para cada gasto recurrente."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Próximos vencimientos</h3>
          <BetaNotice description="Estamos conectando este módulo a datos reales por workspace. Mientras tanto, puedes usar el formulario para registrar estructura operativa sin ver cifras ficticias." />
        </Card>
        <FixedExpenseForm />
      </div>
    </div>
  );
}
