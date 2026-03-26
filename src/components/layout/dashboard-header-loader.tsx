 "use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { formatCurrency } from "@/lib/formatters/currency";
import {
  DashboardHeaderMetric,
  useDashboardHeader
} from "@/components/layout/dashboard-header-context";

const WATCHED_PATHS = new Set(["/", "/cuentas", "/movimientos", "/pendientes", "/resumen"]);

function createMetric(amount: number): DashboardHeaderMetric {
  return {
    label: "Total disponible",
    value: formatCurrency(amount),
    tone: amount >= 0 ? "positive" : "negative"
  };
}

export function DashboardHeaderLoader() {
  const { setMetric } = useDashboardHeader();
  const pathname = usePathname();
  const totalCache = useRef<number | null>(null);

  useEffect(() => {
    if (!WATCHED_PATHS.has(pathname)) {
      setMetric(null);
      return;
    }

    if (totalCache.current !== null) {
      setMetric(createMetric(totalCache.current));
      return;
    }

    let active = true;

    async function loadTotal() {
      try {
        const response = await fetch("/api/accounts", { cache: "no-store" });
        if (!active) return;
        if (!response.ok) throw new Error("No se pudo calcular el total disponible");
        const payload = (await response.json()) as { items: { balance: number; type?: string }[] };
        const total = payload.items.reduce(
          (sum, account) => (account.type === "CREDITO" ? sum : sum + account.balance),
          0
        );
        totalCache.current = total;
        if (!active) return;
        setMetric(createMetric(total));
      } catch {
        if (active) {
          setMetric({
            label: "Total disponible",
            value: "—",
            tone: "neutral"
          });
        }
      }
    }

    void loadTotal();

    return () => {
      active = false;
    };
  }, [pathname, setMetric]);

  useEffect(() => {
    function handleInvalidate() {
      totalCache.current = null;
      // Best effort: if we're on a watched path, force a reload by re-setting metric to null,
      // the other effect will re-fetch on next navigation; we also trigger a lightweight refresh now.
      if (!WATCHED_PATHS.has(window.location.pathname)) return;
      setMetric(null);
      // Trigger fetch by simulating "cache miss": the main effect will run on pathname changes only,
      // so we fetch here too.
      (async () => {
        try {
          const response = await fetch("/api/accounts", { cache: "no-store" });
          if (!response.ok) throw new Error();
          const payload = (await response.json()) as { items: { balance: number; type?: string }[] };
          const total = payload.items.reduce(
            (sum, account) => (account.type === "CREDITO" ? sum : sum + account.balance),
            0
          );
          totalCache.current = total;
          setMetric(createMetric(total));
        } catch {
          setMetric({
            label: "Total disponible",
            value: "—",
            tone: "neutral"
          });
        }
      })();
    }

    window.addEventListener("mis-finanzas:accounts-changed", handleInvalidate);
    return () => {
      window.removeEventListener("mis-finanzas:accounts-changed", handleInvalidate);
    };
  }, [setMetric]);

  return null;
}
