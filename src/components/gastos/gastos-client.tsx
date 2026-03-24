"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewTransactionModal } from "@/components/movimientos/new-transaction-modal";
import { TransactionsTable } from "@/components/tables/transactions-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function GastosClient() {
  const [tableKey, setTableKey] = useState(0);
  const [openModal, setOpenModal] = useState(false);

  return (
    <div className="space-y-4 pb-20 sm:space-y-5">
      <Card id="agregar-gasto" className="premium-surface animate-fade-up space-y-3 p-4 sm:p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Movimientos</p>
        <h2 className="text-lg font-semibold text-slate-900">Registro ultrarrápido</h2>
        <p className="text-sm text-slate-500">
          Agrega un gasto o ingreso en pocos toques y sigue con tu día.
        </p>
        <Button
          type="button"
          className="h-11 w-full rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-emerald-500 shadow-soft sm:w-auto"
          onClick={() => setOpenModal(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva transacción
        </Button>
      </Card>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900">Movimientos recientes</h3>
        <p className="text-sm text-slate-500">Vista simple para revisar y controlar tu dinero real.</p>
      </section>

      <TransactionsTable key={tableKey} />

      <button
        type="button"
        onClick={() => setOpenModal(true)}
        className="fixed bottom-24 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-emerald-500 text-white shadow-[0_18px_32px_rgba(124,58,237,0.38)] transition hover:scale-[1.03]"
        aria-label="Nueva transacción"
      >
        <Plus className="h-6 w-6" />
      </button>

      <NewTransactionModal
        open={openModal}
        onOpenChange={setOpenModal}
        onSuccess={() => setTableKey((value) => value + 1)}
      />
    </div>
  );
}
