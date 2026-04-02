"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { BASE_TRANSACTION_MARKER } from "@/lib/constants/transactions";

export type TransactionRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "INGRESO" | "EGRESO" | "TRANSFERENCIA";
  accountId?: string | null;
  account: string;
  categoryId?: string | null;
  category: string;
  businessUnit: string;
  origin: "PERSONAL" | "EMPRESA";
  reimbursable: boolean;
  reviewStatus: "PENDIENTE" | "REVISADO" | "OBSERVADO";
  notes?: string | null;
  creditImpactType?: "consume_cupo" | "no_consume_cupo" | "pago_tarjeta" | "ajuste_manual";

  // Optional credit-card installment context (stored in Transaction.metadata).
  isInstallmentPurchase?: boolean;
  cuotaActual?: number | null;
  cuotaTotal?: number | null;
  cuotasRestantes?: number | null;
  installmentLabelRaw?: string | null;
};

type FilterRange = "today" | "week" | "month";

export type TransactionFilters = {
  range: FilterRange;
  search: string;
  accountId: string;
  categoryId: string;
  type: "INGRESO" | "EGRESO" | "";
};

const DEFAULT_FILTERS: TransactionFilters = {
  range: "today",
  search: "",
  accountId: "",
  categoryId: "",
  type: ""
};

function getRangeDates(range: FilterRange) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (range === "today") {
    // start is today at midnight
  } else if (range === "week") {
    start.setDate(start.getDate() - 7);
  } else if (range === "month") {
    start.setMonth(start.getMonth() - 1);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0]
  };
}

export function buildTransactionQuery(filters: TransactionFilters) {
  const params = new URLSearchParams();
  params.set("take", "80");
  const { start, end } = getRangeDates(filters.range);
  params.set("startDate", start);
  params.set("endDate", end);
  if (filters.search) params.set("search", filters.search);
  if (filters.accountId) params.set("accountId", filters.accountId);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.type) params.set("type", filters.type);
  return params.toString();
}

export function useTransactionsWithFilters() {
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<
    {
      id: string;
      name: string;
      bank: string;
      type: "CREDITO" | "DEBITO" | "EFECTIVO";
      balance: number;
      creditBalance: number;
      color: string | null;
      icon: string | null;
      appearanceMode: "auto" | "manual";
    }[]
  >([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const query = useMemo(() => buildTransactionQuery(filters), [filters]);

  const refresh = useCallback(() => {
    setFilters((prev) => ({ ...prev }));
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/transactions?${query}`, {
          cache: "no-store"
        });
        if (!response.ok) throw new Error("No se pudieron cargar los movimientos.");
        const payload = (await response.json()) as { items: TransactionRow[] };
        if (!active) return;
        setRows(payload.items.filter((row) => row.description !== BASE_TRANSACTION_MARKER));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los movimientos.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [query]);

  useEffect(() => {
    let active = true;
    async function loadAccounts() {
      try {
        const response = await fetch("/api/accounts", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const payload = (await response.json()) as {
          items: {
            id: string;
            name: string;
            bank: string;
            type: "CREDITO" | "DEBITO" | "EFECTIVO";
            balance: number;
            creditBalance: number;
            color: string | null;
            icon: string | null;
            appearanceMode: "auto" | "manual";
          }[];
        };
        if (active) setAccounts(payload.items);
      } catch {
        if (active) setAccounts([]);
      }
    }
    void loadAccounts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadCategories() {
      try {
        const response = await fetch("/api/categories", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const payload = (await response.json()) as { items: { id: string; name: string }[] };
        if (active) setCategories(payload.items);
      } catch {
        if (active) setCategories([]);
      }
    }
    void loadCategories();
    return () => {
      active = false;
    };
  }, []);

  return {
    rows,
    loading,
    error,
    filters,
    setFilters,
    accounts,
    categories,
    refresh
  };
}
