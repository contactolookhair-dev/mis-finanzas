"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { CalculatorWidget } from "@/components/inicio/calculator-widget";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculatorInput: string;
  calculatorResult: number | null;
  onAppend: (symbol: string) => void;
  onClear: () => void;
  onDelete: () => void;
  onEquals: () => void;
  evaluateExpression: (value: string) => number | null;
};

function normalizeCalculatorValue(value: number) {
  if (!Number.isFinite(value)) return null;
  // CLP is integer-first; keep 2 decimals only when meaningful.
  const normalized = Math.abs(value % 1) > 0.000001 ? Number(value.toFixed(2)) : Math.round(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function CalculatorOverlay({
  open,
  onOpenChange,
  calculatorInput,
  calculatorResult,
  onAppend,
  onClear,
  onDelete,
  onEquals,
  evaluateExpression
}: Props) {
  useLockBodyScroll(open);
  if (!open) return null;

  const resolvedResult = calculatorResult ?? evaluateExpression(calculatorInput);
  const canApply = resolvedResult !== null && normalizeCalculatorValue(resolvedResult) !== null;

  function handleApply() {
    const next = resolvedResult ?? evaluateExpression(calculatorInput);
    if (next === null) return;
    const normalized = normalizeCalculatorValue(next);
    if (normalized === null) return;

    try {
      window.dispatchEvent(
        new CustomEvent("mis-finanzas:calculator-apply", {
          detail: {
            value: normalized
          }
        })
      );
    } catch {
      // noop
    }

    onOpenChange(false);
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/36 p-0 sm:items-center sm:p-4">
      <div
        className={cn(
          "glass-surface safe-pb w-full max-h-[88vh] overflow-y-auto rounded-t-[28px] p-4 ring-1 ring-white/35 sm:max-w-md sm:rounded-[32px] sm:p-5",
          "animate-modal-sheet"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Calculadora"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Calculadora
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">Calcula sin salir</h3>
            <p className="mt-1 text-sm text-slate-500">
              Úsala como capa auxiliar y vuelve al formulario sin perder nada.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="tap-feedback rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
            aria-label="Cerrar calculadora"
          >
            <Plus className="h-4 w-4 rotate-45" />
          </button>
        </div>

        <SurfaceCard variant="soft" padding="sm" className="shadow-none">
          <CalculatorWidget
            calculatorInput={calculatorInput}
            calculatorResult={calculatorResult}
            onAppend={onAppend}
            onClear={onClear}
            onDelete={onDelete}
            onEquals={onEquals}
            compact
          />
        </SurfaceCard>

        <div className="mt-3 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1 rounded-2xl" onClick={onEquals}>
            Recalcular
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={!canApply}
            onClick={handleApply}
          >
            Usar resultado
          </Button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Al usar el resultado, lo insertamos en el monto del formulario activo (si está abierto).
        </p>
      </div>
    </div>
  );
}
