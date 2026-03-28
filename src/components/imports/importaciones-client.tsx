"use client";

import { ImportTransactionsPanel } from "@/components/imports/import-transactions-panel";
import { PageContainer } from "@/components/ui/page-container";
import { SectionHeader } from "@/components/ui/section-header";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { EmptyStateCard, ErrorStateCard, Skeleton } from "@/components/ui/states";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { AlertCircle, BadgeCheck, CreditCard, FileWarning, Landmark, TriangleAlert } from "lucide-react";

type ImportHistoryItem = {
  id: string;
  fileName: string;
  parser: string;
  status: string;
  rowsTotal: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  createdAt: string;
  completedAt: string | null;
  importType: "account" | "credit";
  detectedBank: string | null;
  visualState: "ok" | "warning" | "low_confidence" | "error";
  warningsCount: number;
  confidence: number | null;
  dubiousCount: number;
  account: {
    id: string;
    name: string | null;
    institution: string | null;
    type: string | null;
  } | null;
  statement: {
    periodLabel: string | null;
    totalBilled: number | null;
    minimumDue: number | null;
    paymentDate: string | null;
  } | null;
};

type HistoryFilter = "all" | "account" | "credit" | "warning" | "low_confidence";

function getHistoryStateMeta(item: ImportHistoryItem) {
  if (item.visualState === "error") {
    return {
      label: "Error",
      classes: "border-rose-200 bg-rose-50 text-rose-700",
      icon: AlertCircle
    };
  }
  if (item.visualState === "low_confidence") {
    return {
      label: "Baja confianza",
      classes: "border-amber-200 bg-amber-50 text-amber-800",
      icon: FileWarning
    };
  }
  if (item.visualState === "warning") {
    return {
      label: "Con warnings",
      classes: "border-orange-200 bg-orange-50 text-orange-800",
      icon: TriangleAlert
    };
  }
  return {
    label: "Importado OK",
    classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: BadgeCheck
  };
}

export function ImportacionesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const batchId = searchParams.get("batchId");
  const importType = searchParams.get("type");
  const accountId = searchParams.get("accountId");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<ImportHistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batch, setBatch] = useState<null | {
    id: string;
    fileName: string;
    parser: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    metadata: unknown;
  }>(null);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await fetch("/api/imports/batches?take=24", { cache: "no-store" });
        if (!response.ok) {
          const msg = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(msg?.message ?? "No se pudo cargar el historial de importaciones.");
        }
        const payload = (await response.json()) as { items: ImportHistoryItem[] };
        if (!active) return;
        setHistoryItems(payload.items ?? []);
      } catch (error) {
        if (!active) return;
        setHistoryError(
          error instanceof Error ? error.message : "No se pudo cargar el historial de importaciones."
        );
        setHistoryItems([]);
      } finally {
        if (active) setHistoryLoading(false);
      }
    }

    void loadHistory();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadBatch() {
      if (!batchId) {
        setBatch(null);
        setBatchError(null);
        return;
      }

      setBatchLoading(true);
      setBatchError(null);
      try {
        const response = await fetch(`/api/imports/batches/${encodeURIComponent(batchId)}`, {
          cache: "no-store"
        });
        if (!response.ok) {
          const msg = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(msg?.message ?? "No se pudo cargar el lote de importación.");
        }
        const payload = (await response.json()) as {
          id: string;
          fileName: string;
          parser: string;
          status: string;
          createdAt: string;
          completedAt: string | null;
          metadata: unknown;
        };
        if (!active) return;
        setBatch(payload);
      } catch (error) {
        if (!active) return;
        setBatchError(error instanceof Error ? error.message : "No se pudo cargar el lote de importación.");
        setBatch(null);
      } finally {
        if (active) setBatchLoading(false);
      }
    }

    void loadBatch();
    return () => {
      active = false;
    };
  }, [batchId]);

  const statementSummary = useMemo(() => {
    const meta = batch?.metadata;
    if (!meta || typeof meta !== "object") return null;
    const stmt = (meta as Record<string, unknown>).creditCardStatement;
    if (!stmt || typeof stmt !== "object") return null;
    const summary = (stmt as Record<string, unknown>).summary;
    if (!summary || typeof summary !== "object") return null;
    const periodLabel = (summary as Record<string, unknown>).periodLabel;
    const totalBilled = (summary as Record<string, unknown>).totalBilled;
    const minimumPayment = (summary as Record<string, unknown>).minimumPayment;
    const dueDate = (summary as Record<string, unknown>).dueDate;
    return {
      periodLabel: typeof periodLabel === "string" ? periodLabel : null,
      totalBilled: typeof totalBilled === "number" ? totalBilled : null,
      minimumPayment: typeof minimumPayment === "number" ? minimumPayment : null,
      dueDate: typeof dueDate === "string" ? dueDate : null
    };
  }, [batch?.metadata]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === "all") return historyItems;
    if (historyFilter === "account") {
      return historyItems.filter((item) => item.importType === "account");
    }
    if (historyFilter === "credit") {
      return historyItems.filter((item) => item.importType === "credit");
    }
    if (historyFilter === "warning") {
      return historyItems.filter((item) => item.visualState === "warning");
    }
    return historyItems.filter((item) => item.visualState === "low_confidence");
  }, [historyFilter, historyItems]);

  return (
    <PageContainer className="space-y-6">
      <SectionHeader
        eyebrow="Importaciones"
        title="Importar desde PDF"
        description="Sube una cartola bancaria o estado de cuenta de tarjeta. Analizaremos el archivo y te mostraremos una vista previa editable antes de guardar."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="h-10 rounded-2xl"
              onClick={() => {
                const lane = importType === "credit" ? "credit" : "account";
                window.dispatchEvent(new CustomEvent("imports:open-file-picker", { detail: { lane } }));
                document.getElementById("imports-preview-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Subir PDF bancario
            </Button>
            <StatPill tone="premium">Preview editable</StatPill>
          </div>
        }
      />

      <p className="text-sm text-slate-600">
        Compatible con cartolas bancarias y estados de cuenta de tarjetas de crédito. Sube tu PDF para detectar movimientos, pagos y compras en cuotas antes de importar.
      </p>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1.3fr_1.8fr]">
        <SurfaceCard variant="soft" padding="sm" className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Cuenta corriente / débito
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">Sube movimientos de cuenta</p>
              <p className="mt-1 text-sm text-slate-600">
                CSV, Excel o PDF con revisión previa antes de guardar.
              </p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-700">
              <Landmark className="h-5 w-5" />
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-10 rounded-2xl"
              onClick={() => router.replace("/importaciones")}
            >
              Subir cuenta
            </Button>
          </div>
        </SurfaceCard>

        <SurfaceCard variant="soft" padding="sm" className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Tarjetas de crédito
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">Estado de cuenta inteligente</p>
              <p className="mt-1 text-sm text-slate-600">
                Optimizado para PDF CMR/Falabella con revisión humana antes de importar.
              </p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-700">
              <CreditCard className="h-5 w-5" />
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-10 rounded-2xl"
              onClick={() => router.replace("/importaciones?type=credit")}
            >
              Subir tarjeta
            </Button>
          </div>
        </SurfaceCard>

        <SurfaceCard variant="soft" padding="sm" className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Historial reciente
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">Vuelve a tus últimas importaciones</p>
              <p className="mt-1 text-sm text-slate-600">
                Detecta rápido lotes con warnings, baja confianza o errores.
              </p>
            </div>
            <StatPill tone="neutral">{historyItems.length} lotes</StatPill>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "account", "credit", "warning", "low_confidence"] as HistoryFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setHistoryFilter(filter)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  historyFilter === filter
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white/80 text-slate-600"
                }`}
              >
                {filter === "all"
                  ? "Todos"
                  : filter === "account"
                    ? "Cuenta"
                    : filter === "credit"
                      ? "Tarjeta"
                      : filter === "warning"
                        ? "Con warnings"
                        : "Baja confianza"}
              </button>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {importType === "credit" ? (
        <SurfaceCard variant="soft" padding="sm" className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Abierto desde tarjeta
          </p>
          <p className="text-sm font-semibold text-slate-900">Importación orientada a estado de cuenta</p>
          <p className="text-xs text-slate-500">
            Dejamos preseleccionada la subida de tarjeta de crédito para que sigas el flujo más rápido.
          </p>
          {accountId ? (
            <p className="text-[11px] text-slate-500">
              Cuenta sugerida: <span className="font-mono">{accountId.slice(0, 10)}…</span>
            </p>
          ) : null}
        </SurfaceCard>
      ) : null}

      {batchId ? (
        <SurfaceCard variant="soft" padding="sm" className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Abierto desde tarjeta
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Lote de importación</p>
              <p className="mt-1 text-xs text-slate-500">
                {batchLoading
                  ? "Cargando detalles del lote..."
                  : batchError
                    ? batchError
                    : batch
                      ? `Archivo: ${batch.fileName}`
                      : "—"}
              </p>
              {statementSummary?.periodLabel ? (
                <p className="mt-1 text-xs text-slate-600">
                  {statementSummary.periodLabel}
                  {statementSummary.totalBilled !== null ? ` · Total ${formatCurrency(statementSummary.totalBilled)}` : ""}
                  {statementSummary.minimumPayment !== null
                    ? ` · Mínimo ${formatCurrency(statementSummary.minimumPayment)}`
                    : ""}
                </p>
              ) : null}
              {batch ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  ID: <span className="font-mono">{batch.id.slice(0, 10)}…</span>
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-9 rounded-2xl"
                onClick={() => router.replace("/importaciones")}
              >
                Limpiar
              </Button>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      <SurfaceCard variant="soft" padding="sm" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Historial de importaciones recientes
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">Tus últimos lotes, bien ordenados</p>
            <p className="mt-1 text-sm text-slate-600">
              Revisa qué salió bien, qué quedó con warnings y vuelve rápido al lote o cuenta asociada.
            </p>
          </div>
          <StatPill tone="premium">
            {filteredHistory.length} resultado{filteredHistory.length === 1 ? "" : "s"}
          </StatPill>
        </div>

        {historyLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SurfaceCard key={index} variant="default" padding="sm" className="space-y-3 shadow-none">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </SurfaceCard>
            ))}
          </div>
        ) : historyError ? (
          <ErrorStateCard
            title="No se pudo cargar el historial"
            description={historyError}
            className="shadow-none"
          />
        ) : filteredHistory.length === 0 ? (
          <EmptyStateCard
            title="Aún no hay importaciones para este filtro"
            description="Cuando subas documentos o revises más lotes, aparecerán aquí con su estado y accesos rápidos."
            className="shadow-none"
          />
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item) => {
              const stateMeta = getHistoryStateMeta(item);
              const StateIcon = stateMeta.icon;
              const statement = item.statement;
              return (
                <div
                  key={item.id}
                  className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.fileName}</p>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateMeta.classes}`}>
                          <StateIcon className="h-3.5 w-3.5" />
                          {stateMeta.label}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {item.importType === "credit" ? "Tarjeta de crédito" : "Cuenta corriente / débito"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(item.createdAt)} · {item.detectedBank ?? "Banco no detectado"}
                        {item.account?.name ? ` · ${item.account.name}` : ""}
                      </p>
                      {statement?.periodLabel || statement?.totalBilled !== null ? (
                        <p className="mt-1 text-xs text-slate-600">
                          {statement?.periodLabel ?? "Período detectado"}
                          {statement?.totalBilled !== null && statement?.totalBilled !== undefined
                            ? ` · Total ${formatCurrency(statement.totalBilled)}`
                            : ""}
                          {statement?.minimumDue !== null && statement?.minimumDue !== undefined
                            ? ` · Mínimo ${formatCurrency(statement.minimumDue)}`
                            : ""}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 rounded-2xl"
                        onClick={() => {
                          window.location.href = `/importaciones?batchId=${encodeURIComponent(item.id)}`;
                        }}
                      >
                        Revisar lote
                      </Button>
                      {item.account?.id ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 rounded-2xl"
                          onClick={() => {
                            window.location.href =
                              item.importType === "credit"
                                ? `/cuentas?card=${encodeURIComponent(item.account!.id)}`
                                : "/cuentas";
                          }}
                        >
                          {item.importType === "credit" ? "Abrir tarjeta" : "Abrir cuenta"}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Importados</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{item.importedCount}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Warnings</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {item.warningsCount}
                        {item.dubiousCount > 0 ? ` · ${item.dubiousCount} dudosas` : ""}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Confianza</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {item.confidence !== null ? `${Math.round(item.confidence * 100)}%` : "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Estado técnico</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {item.status === "FAILED" ? "Falló" : item.status === "COMPLETED" ? "Completado" : "Procesando"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      <div id="imports-preview-panel">
        <ImportTransactionsPanel
          initialLane={importType === "credit" ? "credit" : "account"}
          initialAccountId={accountId}
        />
      </div>
    </PageContainer>
  );
}
