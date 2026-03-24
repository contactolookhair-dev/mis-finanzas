import { ImportTransactionsPanel } from "@/components/imports/import-transactions-panel";
import { MovementsToolbar } from "@/components/movements/movements-toolbar";
import { TransactionsTable } from "@/components/tables/transactions-table";
import { SectionHeader } from "@/components/ui/section-header";

export default function MovimientosPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Control operativo"
        title="Movimientos"
        description="Tabla responsive para revisar, buscar y corregir clasificaciones entre personal y empresa."
      />

      <MovementsToolbar />

      <ImportTransactionsPanel />

      <TransactionsTable />
    </div>
  );
}
