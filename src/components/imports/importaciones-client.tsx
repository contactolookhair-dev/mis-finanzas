"use client";

import { ImportTransactionsPanel } from "@/components/imports/import-transactions-panel";
import { PageContainer } from "@/components/ui/page-container";
import { SectionHeader } from "@/components/ui/section-header";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/formatters/currency";

export function ImportacionesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const batchId = searchParams.get("batchId");
  const importType = searchParams.get("type");
  const accountId = searchParams.get("accountId");
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

  return (
    <PageContainer className="space-y-6">
      <SectionHeader
        eyebrow="Importaciones"
        title="Subir cartolas"
        description="Importa movimientos desde CSV, Excel o PDF y revisa antes de guardar."
        actions={<StatPill tone="premium">Vista previa real</StatPill>}
      />

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

      <ImportTransactionsPanel
        initialLane={importType === "credit" ? "credit" : "account"}
        initialAccountId={accountId}
      />
    </PageContainer>
  );
}
