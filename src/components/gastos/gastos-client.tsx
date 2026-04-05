"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TransactionEntryModal } from "@/components/movimientos/transaction-entry-modal";
import { TransactionsTable } from "@/components/tables/transactions-table";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";

export function GastosClient() {
  const [tableKey, setTableKey] = useState(0);
  const [openModal, setOpenModal] = useState(false);

  return (
    <div className="space-y-4 pb-16 sm:space-y-5">
      <SectionHeader
        eyebrow="Dinero real"
        title="Movimientos"
        description="Registra gastos e ingresos con una vista directa y sin relleno."
        actions={
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-full px-3 font-semibold"
            onClick={() => setOpenModal(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva
          </Button>
        }
      />

      <SectionHeader
        compact
        eyebrow="Actividad"
        title="Movimientos recientes"
        description="Vista simple para revisar y controlar tu dinero real."
      />

      <TransactionsTable key={tableKey} />

      <TransactionEntryModal
        open={openModal}
        onOpenChange={setOpenModal}
        onSuccess={() => setTableKey((value) => value + 1)}
      />
    </div>
  );
}
