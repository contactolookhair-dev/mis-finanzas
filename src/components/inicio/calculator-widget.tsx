"use client";

import { useMemo } from "react";

type Props = {
  calculatorInput: string;
  calculatorResult: number | null;
  onAppend: (symbol: string) => void;
  onClear: () => void;
  onDelete: () => void;
  onEquals: () => void;
  compact?: boolean;
};

export function CalculatorWidget({
  calculatorInput,
  calculatorResult,
  onAppend,
  onClear,
  onDelete,
  onEquals,
  compact = false
}: Props) {
  const keys = useMemo(
    () => ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "⌫", "+"],
    []
  );

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-right text-2xl font-semibold text-slate-900">
        {calculatorInput || "0"}
      </div>
      <p className="text-[11px] text-slate-500">
        Resultado:{" "}
        {calculatorResult !== null
          ? calculatorResult.toLocaleString("es-CL", { maximumFractionDigits: 2 })
          : "-"}
      </p>
      <div className={`grid grid-cols-4 gap-2 text-sm ${compact ? "gap-2" : "gap-2"}`}>
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (key === "⌫") {
                onDelete();
                return;
              }
              onAppend(key);
            }}
            className="tap-feedback rounded-2xl border border-slate-200 bg-white/70 py-3 font-semibold text-slate-900 transition hover:scale-[1.01]"
          >
            {key}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClear}
          className="flex-1 rounded-2xl border border-rose-200 bg-rose-50/70 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={onEquals}
          className="flex-1 rounded-2xl border border-emerald-300 bg-emerald-50/70 py-3 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-100"
        >
          =
        </button>
      </div>
    </div>
  );
}
