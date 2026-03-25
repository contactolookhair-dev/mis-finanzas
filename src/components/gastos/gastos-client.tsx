"use client";

import { useState } from "react";
import { Plus, ReceiptText, Sparkles } from "lucide-react";
import { NewTransactionModal } from "@/components/movimientos/new-transaction-modal";
import { TransactionsTable } from "@/components/tables/transactions-table";
import { Button } from "@/components/ui/button";
import { MobileStickyAction } from "@/components/ui/mobile-sticky-action";
import { SectionHeader } from "@/components/ui/section-header";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";

export function GastosClient() {
  const [tableKey, setTableKey] = useState(0);
  const [openModal, setOpenModal] = useState(false);

  return (
    <div className="space-y-5 pb-20 sm:space-y-6">
      <SectionHeader
        eyebrow="Dinero real"
        title="Movimientos"
        description="Registra gastos e ingresos de forma rápida, con una vista limpia y fácil de revisar."
        actions={
          <StatPill tone="premium" icon={<Sparkles className="h-3.5 w-3.5" />}>
            Registro simple
          </StatPill>
        }
      />

      <SurfaceCard
        id="agregar-gasto"
        variant="highlight"
        className="animate-fade-up space-y-4 overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Accion principal
            </p>
            <h2 className="text-xl font-semibold text-slate-900">Registro ultrarrápido</h2>
            <p className="max-w-xl text-sm text-slate-500">
              Agrega un gasto o ingreso en pocos toques y sigue con tu día.
            </p>
          </div>
          <span className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-violet-600 shadow-[0_10px_26px_rgba(124,58,237,0.12)] sm:inline-flex">
            <ReceiptText className="h-5 w-5" />
          </span>
        </div>
        <Button
          type="button"
          className="hidden h-11 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-emerald-500 shadow-soft sm:inline-flex"
          onClick={() => setOpenModal(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva transacción
        </Button>
      </SurfaceCard>

      <SectionHeader
        compact
        eyebrow="Actividad"
        title="Movimientos recientes"
        description="Vista simple para revisar y controlar tu dinero real."
      />

      <TransactionsTable key={tableKey} />

      <MobileStickyAction type="button" onClick={() => setOpenModal(true)} aria-label="Nueva transacción">
        <Plus className="mr-2 h-5 w-5" />
        Nueva transacción
      </MobileStickyAction>

      <NewTransactionModal
        open={openModal}
        onOpenChange={setOpenModal}
        onSuccess={() => setTableKey((value) => value + 1)}
      />
    </div>
  );
}
