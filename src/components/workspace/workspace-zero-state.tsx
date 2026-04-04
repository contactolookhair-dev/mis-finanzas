"use client";

import { Sparkles, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

export function WorkspaceZeroState({
  title = "Este workspace está vacío",
  description = "Empieza creando tu primera cuenta y registrando un movimiento. También puedes importar tu información.",
  onCreateAccount,
  onCreateMovement,
  onImport
}: {
  title?: string;
  description?: string;
  onCreateAccount: () => void;
  onCreateMovement: () => void;
  onImport: () => void;
}) {
  return (
    <SurfaceCard className="relative overflow-hidden border-border/80 bg-white text-slate-900 shadow-[0_20px_46px_rgba(15,23,42,0.08)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-900/90 via-primary/90 to-emerald-500/80" />
      <div className="relative space-y-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-3xl bg-slate-900 text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)]">
            <Sparkles className="h-5 w-5" strokeWidth={1.9} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight text-slate-900">{title}</p>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button className="rounded-full" onClick={onCreateAccount}>
            <WalletCards className="mr-2 h-4 w-4" strokeWidth={1.9} />
            Crear primera cuenta
          </Button>
          <Button variant="secondary" className="rounded-full" onClick={onCreateMovement}>
            Registrar primer movimiento
          </Button>
          <Button variant="secondary" className="rounded-full" onClick={onImport}>
            Importar datos
          </Button>
        </div>
      </div>
    </SurfaceCard>
  );
}

