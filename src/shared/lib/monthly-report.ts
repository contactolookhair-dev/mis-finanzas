import type { DashboardFilters } from "@/shared/types/dashboard";

const HISTORY_STORAGE_KEY = "mis-finanzas.monthly-report-history.v1";

export type MonthlyReportHistoryEntry = {
  id: string;
  reportType: "PDF mensual";
  periodLabel: string;
  generatedAt: string;
  fileName: string;
  filters: DashboardFilters;
};

function buildHistoryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseFilename(contentDisposition: string | null) {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? null;
}

export function loadMonthlyReportHistory(): MonthlyReportHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as MonthlyReportHistoryEntry[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => {
      return (
        typeof item?.id === "string" &&
        item.reportType === "PDF mensual" &&
        typeof item.periodLabel === "string" &&
        typeof item.generatedAt === "string" &&
        typeof item.fileName === "string" &&
        typeof item.filters === "object"
      );
    });
  } catch {
    return [];
  }
}

export function saveMonthlyReportHistory(entries: MonthlyReportHistoryEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, 10)));
}

export function appendMonthlyReportHistory(entry: MonthlyReportHistoryEntry) {
  const current = loadMonthlyReportHistory();
  const next = [entry, ...current].slice(0, 10);
  saveMonthlyReportHistory(next);
  return next;
}

export function createMonthlyReportHistoryEntry(params: {
  periodLabel: string;
  filters: DashboardFilters;
  fileName: string;
}) {
  return {
    id: buildHistoryId(),
    reportType: "PDF mensual" as const,
    periodLabel: params.periodLabel,
    generatedAt: new Date().toISOString(),
    fileName: params.fileName,
    filters: params.filters
  };
}

export async function downloadMonthlyReportPdf(filters: DashboardFilters) {
  const response = await fetch("/api/reports/monthly", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ filters })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? "No se pudo generar el reporte mensual.");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const filename = parseFilename(response.headers.get("Content-Disposition")) ?? "reporte-mensual.pdf";

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);

  return { fileName: filename };
}
