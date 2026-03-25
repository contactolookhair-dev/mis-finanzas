"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Download, FileClock, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import {
  appendMonthlyReportHistory,
  createMonthlyReportHistoryEntry,
  downloadMonthlyReportPdf,
  loadMonthlyReportHistory,
  type MonthlyReportHistoryEntry
} from "@/shared/lib/monthly-report";
import type { AuthSessionResponse } from "@/shared/types/auth";
import type { DashboardFilters } from "@/shared/types/dashboard";

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function MonthlyReportSection({
  filters,
  periodLabel
}: {
  filters: DashboardFilters | null;
  periodLabel: string | null;
}) {
  const [authLoading, setAuthLoading] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);
  const [history, setHistory] = useState<MonthlyReportHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const session = await fetchAuthSession();
        setAuthSession(session);
      } catch {
        setAuthSession({ authenticated: false });
      } finally {
        setAuthLoading(false);
      }
    }

    setHistory(loadMonthlyReportHistory());
    void loadSession();
  }, []);

  const canExport =
    authSession?.authenticated === true && authSession.permissions
      ? authSession.permissions.canExportReports
      : false;

  const summary = useMemo(() => {
    if (!filters) {
      return "Se usará el período visible en el resumen cuando esté disponible.";
    }

    return [
      periodLabel ?? "Período mensual",
      filters.financialOrigin ? `Origen ${filters.financialOrigin === "PERSONAL" ? "personal" : "empresa"}` : "Todos los orígenes"
    ].join(" · ");
  }, [filters, periodLabel]);

  async function handleExport(targetFilters: DashboardFilters | null, targetPeriodLabel: string | null) {
    if (!targetFilters) {
      setError("Todavía no está listo el período para exportar.");
      return;
    }

    if (!canExport) {
      setError("Tu rol actual no tiene permiso para exportar reportes.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { fileName } = await downloadMonthlyReportPdf(targetFilters);
      const nextHistory = appendMonthlyReportHistory(
        createMonthlyReportHistoryEntry({
          periodLabel: targetPeriodLabel ?? "Período mensual",
          filters: targetFilters,
          fileName
        })
      );

      setHistory(nextHistory);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Error exportando reporte mensual.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4 rounded-[28px] border border-white/75 bg-white/90 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.07)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileClock className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Reporte mensual
            </p>
          </div>
          <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Exportación y historial</h3>
          <p className="text-sm text-neutral-500">{summary}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          className="rounded-full"
          disabled={authLoading || !canExport || loading || !filters}
          onClick={() => void handleExport(filters, periodLabel)}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando PDF
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </>
          )}
        </Button>
        {!authLoading && !canExport ? (
          <p className="text-sm text-neutral-500">Tu rol actual puede ver datos, pero no exportar reportes.</p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-neutral-400" />
            <p className="text-sm font-semibold text-slate-900">Historial reciente</p>
          </div>
          <p className="text-xs text-neutral-500">{history.length} exportaciones</p>
        </div>

        {history.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-slate-600">
            Aún no has generado reportes mensuales desde este dispositivo.
          </div>
        ) : (
          <div className="space-y-2.5">
            {history.slice(0, 4).map((entry) => (
              <div
                key={entry.id}
                className="rounded-[22px] border border-white/75 bg-white/80 p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{entry.periodLabel}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
                      {entry.reportType} · {formatGeneratedAt(entry.generatedAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-9 rounded-full px-3 text-xs"
                    disabled={authLoading || !canExport || loading}
                    onClick={() => void handleExport(entry.filters, entry.periodLabel)}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Descargando
                      </>
                    ) : (
                      <>
                        <RotateCcw className="mr-2 h-3.5 w-3.5" />
                        Descargar de nuevo
                      </>
                    )}
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Archivo: {entry.fileName}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
