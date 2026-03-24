"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import type { AuthSessionResponse } from "@/shared/types/auth";
import type { DashboardFilters } from "@/shared/types/dashboard";
import type { ExportFormat, ExportReportType } from "@/shared/types/exports";

const reportTypeLabels: Record<ExportReportType, string> = {
  dashboard_summary: "Resumen del dashboard",
  transactions_filtered: "Movimientos filtrados",
  financial_period: "Reporte financiero por período",
  business_unit_summary: "Resumen por unidad de negocio",
  personal_money_summary: "Dinero personal usado en empresas"
};

export function ExportActions({
  filters,
  defaultReportType = "dashboard_summary",
  compact = false
}: {
  filters: DashboardFilters;
  defaultReportType?: ExportReportType;
  compact?: boolean;
}) {
  const [authLoading, setAuthLoading] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);
  const [reportType, setReportType] = useState<ExportReportType>(defaultReportType);
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);
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

    void loadSession();
  }, []);

  const canExport =
    authSession?.authenticated === true && authSession.permissions
      ? authSession.permissions.canExportReports
      : false;

  const summary = useMemo(() => {
    return [
      filters.startDate && filters.endDate ? `${filters.startDate} → ${filters.endDate}` : "Período flexible",
      filters.financialOrigin ? `Origen ${filters.financialOrigin}` : "Todos los orígenes"
    ].join(" · ");
  }, [filters]);

  async function handleExport(format: ExportFormat) {
    if (!canExport) {
      setError("Tu rol actual no tiene permiso para exportar reportes.");
      return;
    }

    try {
      setLoadingFormat(format);
      setError(null);

      const response = await fetch("/api/exports/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          format,
          reportType,
          filters
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudo exportar el reporte.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const contentDisposition = response.headers.get("Content-Disposition");
      const match = contentDisposition?.match(/filename=\"?([^"]+)\"?/);
      anchor.href = url;
      anchor.download = match?.[1] ?? `reporte.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Error exportando reporte.");
    } finally {
      setLoadingFormat(null);
    }
  }

  return (
    <Card className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Exportar reportes</p>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            PDF profesional o Excel tabular respetando los filtros activos.
          </p>
        </div>
      </div>

      <Select
        value={reportType}
        onChange={(event) => setReportType(event.target.value as ExportReportType)}
        disabled={authLoading || !canExport || loadingFormat !== null}
      >
        {Object.entries(reportTypeLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-xs text-neutral-500">
        {summary}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={authLoading || !canExport || loadingFormat !== null}
          onClick={() => handleExport("pdf")}
        >
          {loadingFormat === "pdf" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando PDF
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Exportar PDF
            </>
          )}
        </Button>
        <Button
          disabled={authLoading || !canExport || loadingFormat !== null}
          onClick={() => handleExport("xlsx")}
        >
          {loadingFormat === "xlsx" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando Excel
            </>
          ) : (
            <>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exportar Excel
            </>
          )}
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!authLoading && !canExport ? (
        <p className="text-sm text-neutral-500">Tu rol actual puede ver datos, pero no exportar reportes.</p>
      ) : null}
    </Card>
  );
}
