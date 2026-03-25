"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import type { AuthSessionResponse } from "@/shared/types/auth";

type DemoAction = "seed" | "clear" | "reset";

export function DemoModeCard() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<DemoAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  const permissions =
    authSession?.authenticated === true && authSession.permissions ? authSession.permissions : null;
  const canUseDemo = Boolean(permissions?.canEditSettings);

  async function handleAction(action: DemoAction) {
    if (action === "clear") {
      const confirmed = window.confirm("Vas a borrar los datos de prueba. ¿Deseas continuar?");
      if (!confirmed) return;
    }

    setLoading(true);
    setLoadingAction(action);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/demo/${action}`, {
        method: action === "clear" ? "DELETE" : "POST",
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        throw new Error((payload.message as string) ?? "No se pudo ejecutar la accion demo.");
      }

      if (payload.summary) {
        const summary = payload.summary as {
          accounts?: number;
          transactions?: number;
          debts?: number;
        };
        setMessage(
          `${(payload.message as string) ?? "Operacion demo completada."} · Cuentas ${summary.accounts ?? 0} · Movimientos ${summary.transactions ?? 0} · Deudas ${summary.debts ?? 0}`
        );
      } else if (payload.result) {
        const result = payload.result as { deletedEntities?: number };
        setMessage(
          `${(payload.message as string) ?? "Operacion demo completada."} · Entidades eliminadas ${result.deletedEntities ?? 0}`
        );
      } else {
        setMessage((payload.message as string) ?? "Operacion demo completada.");
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Error ejecutando modo demo.");
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  return (
    <SurfaceCard variant="highlight" padding="sm" className="space-y-4 border-dashed">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Modo demo</p>
          <p className="text-base font-semibold text-slate-900">Datos de prueba seguros</p>
        </div>
        <StatPill tone={canUseDemo ? "success" : "warning"}>
          {authLoading ? "Validando" : canUseDemo ? "Disponible" : "Solo administradores"}
        </StatPill>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-neutral-500">
          Carga registros ficticios, borra todo lo generado o reinicia el conjunto cuando quieras.
        </p>
      </div>

      {!authLoading && !canUseDemo ? (
        <p className="rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-sm text-amber-700">
          Necesitas permisos de administrador para usar el modo demo.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={authLoading || loading || !canUseDemo} onClick={() => void handleAction("seed")}>
          {loading && loadingAction === "seed" ? "Cargando datos..." : "Cargar datos de prueba"}
        </Button>
        <Button variant="secondary" disabled={authLoading || loading || !canUseDemo} onClick={() => void handleAction("clear")}>
          {loading && loadingAction === "clear" ? "Borrando datos..." : "Borrar datos de prueba"}
        </Button>
        <Button variant="secondary" disabled={authLoading || loading || !canUseDemo} onClick={() => void handleAction("reset")}>
          {loading && loadingAction === "reset" ? "Reiniciando datos..." : "Recargar datos de prueba"}
        </Button>
      </div>

      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </SurfaceCard>
  );
}
