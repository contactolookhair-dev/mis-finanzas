"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  PencilLine,
  Plus,
  Trash2,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyStateCard, ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { SectionHeader } from "@/components/ui/section-header";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import {
  derivePayableStatus,
  sumPayables,
  todayISODate,
  type PayableItem,
  type PayableStatus
} from "./payables-storage";
import { EditTransactionModal } from "@/components/movimientos/edit-transaction-modal";
import type { TransactionRow } from "@/hooks/use-transactions-with-filters";

type DebtorPerson = {
  id: string;
  name: string;
  reason: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: "PENDIENTE" | "ABONANDO" | "PAGADO" | "ATRASADO";
  isInstallmentDebt: boolean;
  installmentCount: number;
  installmentValue: number;
  paidInstallments: number;
  installmentsPending: number;
  nextInstallmentDate: string | null;
  installmentStatus: "AL_DIA" | "PROXIMA" | "VENCIDA" | "PAGADA";
  installmentStatusLabel: string;
  installmentDaysUntilDue: number | null;

  // Optional enrichment when the debt originated from a credit-card transaction with installments.
  creditInstallmentAmount?: number | null;
  creditPurchaseTotalAmount?: number | null;
  creditInstallmentCurrent?: number | null;
  creditInstallmentTotal?: number | null;
  creditInstallmentsRemaining?: number | null;
};

type DebtsPayload = {
  companies: Array<{
    id: string;
    name: string;
    reason: string;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    status: "PENDIENTE" | "ABONANDO" | "PAGADO";
    entries: Array<{
      id: string;
      transactionId: string | null;
      amount: number;
      status: string;
      reimbursedAt: string | null;
      notes: string | null;
      createdAt: string;
    }>;
  }>;
  people: DebtorPerson[];
  totals: {
    pendingPeople: number;
    pendingCompanies: number;
    pendingTotal: number;
  };
};

type ActiveTab = "me-deben" | "debo-pagar";

type AccountItem = {
  id: string;
  name: string;
  bank: string;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
  balance: number;
  creditBalance: number;
  color: string | null;
  icon: string | null;
  appearanceMode: "auto" | "manual";
  creditLimit: number | null;
  closingDay: number | null;
  paymentDay: number | null;
  totalBilled: number | null;
  minimumDue: number | null;
  statementDate: string | null;
  paymentDate: string | null;
};

type CreditHealthItem = {
  accountId: string;
  name: string;
  bank: string | null;
  dueDate: string | null;
  daysToDue: number | null;
  minimumPayment: number | null;
  minimumMissing: number | null;
  coveredMinimum: boolean | null;
  badges: Array<{ key: string; label: string; tone: "alert" | "attention" | "positive" | "info" }>;
};

function toneForInstallmentStatus(status: DebtorPerson["installmentStatus"]) {
  if (status === "AL_DIA") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  if (status === "PROXIMA") return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  if (status === "VENCIDA") return "bg-rose-50 text-rose-700 ring-1 ring-rose-100";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function toneForCompanyDebtStatus(status: "PENDIENTE" | "ABONANDO" | "PAGADO") {
  if (status === "PAGADO") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  if (status === "ABONANDO") return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
}

function toneForPayableStatus(status: PayableStatus) {
  if (status === "PAGADO") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  if (status === "VENCIDO") return "bg-rose-50 text-rose-700 ring-1 ring-rose-100";
  return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
}

function toneForCreditBadge(tone: CreditHealthItem["badges"][number]["tone"]) {
  if (tone === "alert") return "bg-rose-50 text-rose-700 ring-1 ring-rose-100";
  if (tone === "attention") return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  if (tone === "positive") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function safeTitle(text: string) {
  const trimmed = text.trim();
  return trimmed.length ? trimmed : "Pendiente";
}

function normalizeGroupKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim();
}

function safeCounterpartyName(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "Sin nombre";
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function sumPendingThisMonth(people: DebtorPerson[]) {
  // Heuristica simple: si es deuda en cuotas, usamos installmentValue cuando aun hay cuotas pendientes.
  // Si es deuda unica, usamos pendingAmount como "por cobrar".
  return people.reduce((acc, item) => {
    if (item.pendingAmount <= 0) return acc;
    if (item.isInstallmentDebt && item.installmentsPending > 0) {
      return acc + Math.max(0, item.installmentValue);
    }
    return acc + Math.max(0, item.pendingAmount);
  }, 0);
}

export function PendientesClient({ initialTab }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    initialTab === "debo-pagar" ? "debo-pagar" : "me-deben"
  );
  const [debts, setDebts] = useState<DebtsPayload | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [payables, setPayables] = useState<PayableItem[]>([]);
  const [creditHealth, setCreditHealth] = useState<CreditHealthItem[]>([]);
  const [loadingDebts, setLoadingDebts] = useState(true);
  const [errorDebts, setErrorDebts] = useState<string | null>(null);
  const [loadingPayables, setLoadingPayables] = useState(true);
  const [errorPayables, setErrorPayables] = useState<string | null>(null);
  const [loadingCreditHealth, setLoadingCreditHealth] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [editTxOpen, setEditTxOpen] = useState(false);
  const [editTxLoading, setEditTxLoading] = useState(false);
  const [editTxError, setEditTxError] = useState<string | null>(null);
  const [editTx, setEditTx] = useState<TransactionRow | null>(null);

  const [payablesModalOpen, setPayablesModalOpen] = useState(false);
  const [editingPayableId, setEditingPayableId] = useState<string | null>(null);
  const [payableForm, setPayableForm] = useState({
    origin: "",
    amount: "",
    dueDate: todayISODate(),
    notes: ""
  });

  const [createDebtOpen, setCreateDebtOpen] = useState(false);
  const [debtCreateForm, setDebtCreateForm] = useState({
    name: "",
    reason: "",
    totalAmount: "",
    startDate: todayISODate(),
    notes: ""
  });
  const [debtSaving, setDebtSaving] = useState(false);
  const [debtError, setDebtError] = useState<string | null>(null);

  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const selectedDebtor = useMemo(
    () => debts?.people.find((item) => item.id === selectedDebtorId) ?? null,
    [debts?.people, selectedDebtorId]
  );
  const [expandedDebtorGroups, setExpandedDebtorGroups] = useState<Record<string, boolean>>({});
  const [expandedCompanyGroups, setExpandedCompanyGroups] = useState<Record<string, boolean>>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paidAt: todayISODate(),
    notes: ""
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState(false);
  const [settlingKeys, setSettlingKeys] = useState<Record<string, boolean>>({});

  const todayISO = useMemo(() => todayISODate(), []);
  const meDebenTotal = debts?.totals.pendingTotal ?? 0;

  const creditHealthByAccountId = useMemo(() => {
    return new Map(creditHealth.map((item) => [item.accountId, item]));
  }, [creditHealth]);

  const creditCardSuggested = useMemo(() => {
    const unpaidPayables = payables.filter((p) => !p.paidAt);
    return accounts
      .filter((a) => a.type === "CREDITO")
      .map((card) => {
        const debtCurrent = Math.max(0, -card.creditBalance);
        const health = creditHealthByAccountId.get(card.id) ?? null;

        // What the owner should pay (preferred):
        // 1) minimumMissing (minimo pendiente real segun pagos ya registrados en el periodo)
        // 2) minimumPayment (minimo del estado)
        // 3) minimumDue (snapshot guardado en account meta)
        // 4) totalBilled (snapshot)
        // 5) debtCurrent (fallback por movimientos)
        const healthMinMissing =
          typeof health?.minimumMissing === "number" && Number.isFinite(health.minimumMissing)
            ? Math.max(0, health.minimumMissing)
            : null;
        const healthMinimum =
          typeof health?.minimumPayment === "number" && Number.isFinite(health.minimumPayment)
            ? Math.max(0, health.minimumPayment)
            : null;
        const snapshotMin = card.minimumDue !== null ? Math.max(0, card.minimumDue) : null;
        const snapshotTotal = card.totalBilled !== null ? Math.max(0, card.totalBilled) : null;

        const amount =
          healthMinMissing ??
          healthMinimum ??
          snapshotMin ??
          snapshotTotal ??
          (debtCurrent > 0 ? debtCurrent : null);

        const label =
          healthMinMissing !== null
            ? `Minimo pendiente: ${formatCurrency(healthMinMissing)}`
            : healthMinimum !== null
              ? `Minimo: ${formatCurrency(healthMinimum)}`
              : snapshotMin !== null
                ? `Minimo: ${formatCurrency(snapshotMin)}`
                : snapshotTotal !== null
                  ? `Total: ${formatCurrency(snapshotTotal)}`
                  : amount !== null
                    ? `Deuda actual: ${formatCurrency(amount)}`
                    : "Sin deuda pendiente";

        const alreadyTracked = unpaidPayables.some((p) => {
          const origin = (p.origin ?? "").toLowerCase();
          const name = card.name.toLowerCase();
          return origin.includes(name) && (origin.includes("tarjeta") || origin.includes("pago"));
        });

        return {
          id: card.id,
          name: card.name,
          dueDate: (health?.dueDate ?? card.paymentDate)?.slice(0, 10) ?? todayISODate(),
          amount,
          label,
          alreadyTracked,
          hasStatement: Boolean(health) || card.minimumDue !== null || card.totalBilled !== null
        };
      });
  }, [accounts, payables]);

  const deboPagarTotal = useMemo(() => sumPayables(payables.filter((p) => !p.paidAt)), [payables]);
  const porCobrarEsteMes = useMemo(
    () => (debts ? sumPendingThisMonth(debts.people) : 0),
    [debts]
  );

  const meDebenGroups = useMemo(() => {
    if (!debts) return [];

    type Group = {
      key: string;
      name: string;
      totalGeneral: number;
      totalPaid: number;
      pendingTotal: number;
      progressPct: number;
      movementCount: number;
      status: DebtorPerson["installmentStatus"];
      statusLabel: string;
      items: DebtorPerson[];
    };

    const statusSeverity: Record<DebtorPerson["installmentStatus"], number> = {
      VENCIDA: 0,
      PROXIMA: 1,
      AL_DIA: 2,
      PAGADA: 3
    };

    const groups = new Map<string, Group>();

    for (const item of debts.people) {
      const name = safeCounterpartyName(item.name);
      const key = normalizeGroupKey(name);
      const existing =
        groups.get(key) ??
        ({
          key,
          name,
          totalGeneral: 0,
          totalPaid: 0,
          pendingTotal: 0,
          progressPct: 0,
          movementCount: 0,
          status: item.installmentStatus,
          statusLabel: item.installmentStatusLabel,
          items: []
        } satisfies Group);

      existing.items.push(item);
      existing.movementCount += 1;
      existing.totalGeneral += Math.max(0, item.totalAmount);
      existing.pendingTotal += Math.max(0, item.pendingAmount);

      // Worst-of (most urgent) status wins.
      const nextSeverity = statusSeverity[item.installmentStatus] ?? 99;
      const currentSeverity = statusSeverity[existing.status] ?? 99;
      if (nextSeverity < currentSeverity) {
        existing.status = item.installmentStatus;
        existing.statusLabel = item.installmentStatusLabel;
      }

      groups.set(key, existing);
    }

    const list = [...groups.values()];

    for (const group of list) {
      group.totalPaid = Math.max(0, group.totalGeneral - group.pendingTotal);
      group.progressPct =
        group.totalGeneral > 0 ? Math.max(0, Math.min(100, (group.totalPaid / group.totalGeneral) * 100)) : 0;
    }

    list.sort((a, b) => {
      if (b.pendingTotal !== a.pendingTotal) return b.pendingTotal - a.pendingTotal;
      return a.name.localeCompare(b.name);
    });

    // Keep items stable and readable.
    for (const group of list) {
      group.items.sort((a, b) => {
        if (b.pendingAmount !== a.pendingAmount) return b.pendingAmount - a.pendingAmount;
        return a.reason.localeCompare(b.reason);
      });
    }

    return list;
  }, [debts]);

  async function loadDebts() {
    try {
      setLoadingDebts(true);
      setErrorDebts(null);
      const response = await fetch("/api/debts", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudieron cargar los pendientes.");
      }
      const payload = (await response.json()) as DebtsPayload;
      setDebts(payload);
    } catch (error) {
      setErrorDebts(error instanceof Error ? error.message : "Error cargando pendientes.");
    } finally {
      setLoadingDebts(false);
    }
  }

  async function settleCompanyDebt(businessUnitId: string) {
    const paidAt =
      window.prompt("Fecha de pago (YYYY-MM-DD)", todayISODate())?.trim() ?? "";
    if (paidAt && !/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
      window.alert("Fecha inválida. Usa el formato YYYY-MM-DD.");
      return;
    }
    const key = `company:${businessUnitId}`;
    try {
      setSettlingKeys((current) => ({ ...current, [key]: true }));
      const response = await fetch(`/api/debts/${businessUnitId}/settle?kind=company`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidAt: paidAt || undefined })
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "No se pudo marcar como pagado.");
      await loadDebts();
    } finally {
      setSettlingKeys((current) => ({ ...current, [key]: false }));
    }
  }

  async function settlePersonDebts(debtorIds: string[]) {
    if (debtorIds.length === 0) return;
    const paidAt =
      window.prompt("Fecha de pago (YYYY-MM-DD)", todayISODate())?.trim() ?? "";
    if (paidAt && !/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
      window.alert("Fecha inválida. Usa el formato YYYY-MM-DD.");
      return;
    }
    const key = `person-group:${debtorIds[0]}`;
    try {
      setSettlingKeys((current) => ({ ...current, [key]: true }));
      for (const id of debtorIds) {
        const response = await fetch(`/api/debts/${id}/settle?kind=person`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paidAt: paidAt || undefined })
        });
        const payload = (await response.json()) as { ok?: boolean; message?: string };
        if (!response.ok) throw new Error(payload.message ?? "No se pudo marcar como pagado.");
      }
      await loadDebts();
    } finally {
      setSettlingKeys((current) => ({ ...current, [key]: false }));
    }
  }

  async function loadPayables() {
    try {
      setLoadingPayables(true);
      setErrorPayables(null);
      const response = await fetch("/api/payables", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudieron cargar los pagos pendientes.");
      }
      const payload = (await response.json()) as { items?: PayableItem[] };
      setPayables(payload.items ?? []);
    } catch (error) {
      setErrorPayables(error instanceof Error ? error.message : "Error cargando pagos pendientes.");
      setPayables([]);
    } finally {
      setLoadingPayables(false);
    }
  }

  async function loadAccounts() {
    try {
      setLoadingAccounts(true);
      const response = await fetch("/api/accounts", { cache: "no-store" });
      if (!response.ok) {
        setAccounts([]);
        return;
      }
      const payload = (await response.json()) as { items?: AccountItem[] };
      setAccounts(payload.items ?? []);
    } catch {
      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  }

  async function loadCategories() {
    try {
      setLoadingCategories(true);
      const response = await fetch("/api/categories", { cache: "no-store" });
      if (!response.ok) {
        setCategories([]);
        return;
      }
      const payload = (await response.json()) as { items?: { id: string; name: string }[] };
      setCategories(payload.items ?? []);
    } catch {
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }

  async function loadCreditHealth() {
    try {
      setLoadingCreditHealth(true);
      const response = await fetch("/api/accounts/credit/health", { cache: "no-store" });
      if (!response.ok) {
        setCreditHealth([]);
        return;
      }
      const payload = (await response.json()) as { items?: CreditHealthItem[] };
      setCreditHealth(payload.items ?? []);
    } catch {
      setCreditHealth([]);
    } finally {
      setLoadingCreditHealth(false);
    }
  }

  useEffect(() => {
    void loadDebts();
    void loadAccounts();
    void loadCategories();
    void loadPayables();
    void loadCreditHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openEditTransaction(transactionId: string) {
    try {
      setEditTxError(null);
      setEditTxLoading(true);
      const response = await fetch(`/api/transactions/${transactionId}`, { cache: "no-store" });
      const payload = (await response.json()) as { item?: TransactionRow; message?: string };
      if (!response.ok || !payload.item) {
        throw new Error(payload.message ?? "No se pudo cargar el movimiento.");
      }
      setEditTx(payload.item);
      setEditTxOpen(true);
    } catch (error) {
      setEditTxError(error instanceof Error ? error.message : "No se pudo cargar el movimiento.");
      setEditTx(null);
      setEditTxOpen(false);
    } finally {
      setEditTxLoading(false);
    }
  }

  async function deleteCompanyEntry(entry: { id: string; transactionId: string | null }) {
    const ok = window.confirm("Eliminar este movimiento de la deuda? Esto también eliminará el movimiento original.");
    if (!ok) return;

    if (entry.transactionId) {
      const response = await fetch(`/api/transactions/${entry.transactionId}`, { method: "DELETE" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        window.alert(payload.message ?? "No se pudo eliminar el movimiento.");
        return;
      }
      await loadDebts();
      return;
    }

    const response = await fetch(`/api/reimbursements/${entry.id}`, { method: "DELETE" });
    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      window.alert(payload.message ?? "No se pudo eliminar el ítem.");
      return;
    }
    await loadDebts();
  }

  function closePayablesModal() {
    setPayablesModalOpen(false);
    setEditingPayableId(null);
    setPayableForm({ origin: "", amount: "", dueDate: todayISODate(), notes: "" });
  }

  function openCreatePayable() {
    setEditingPayableId(null);
    setPayableForm({ origin: "", amount: "", dueDate: todayISODate(), notes: "" });
    setPayablesModalOpen(true);
  }

  function openCreatePayablePrefill(input: { origin: string; amount: number; dueDate?: string; notes?: string }) {
    setEditingPayableId(null);
    setPayableForm({
      origin: input.origin,
      amount: `${Math.max(0, input.amount)}`,
      dueDate: input.dueDate ?? todayISODate(),
      notes: input.notes ?? ""
    });
    setPayablesModalOpen(true);
  }

  function openEditPayable(item: PayableItem) {
    setEditingPayableId(item.id);
    setPayableForm({
      origin: item.origin,
      amount: `${item.amount}`,
      dueDate: item.dueDate.slice(0, 10),
      notes: item.notes ?? ""
    });
    setPayablesModalOpen(true);
  }

  function upsertPayable() {
    const origin = safeTitle(payableForm.origin);
    const amount = Number(payableForm.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const dueDate = payableForm.dueDate || todayISODate();
    const notes = payableForm.notes?.trim() || null;
    async function run() {
      try {
        setErrorPayables(null);
        if (editingPayableId) {
          const response = await fetch(`/api/payables/${editingPayableId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ origin, amount, dueDate, notes })
          });
          const payload = (await response.json()) as { message?: string };
          if (!response.ok) throw new Error(payload.message ?? "No se pudo guardar el pendiente.");
        } else {
          const response = await fetch("/api/payables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ origin, amount, dueDate, notes })
          });
          const payload = (await response.json()) as { message?: string };
          if (!response.ok) throw new Error(payload.message ?? "No se pudo guardar el pendiente.");
        }
        closePayablesModal();
        await loadPayables();
      } catch (error) {
        setErrorPayables(error instanceof Error ? error.message : "No se pudo guardar el pendiente.");
      }
    }
    void run();
  }

  function deletePayable(id: string) {
    async function run() {
      try {
        setErrorPayables(null);
        const response = await fetch(`/api/payables/${id}`, { method: "DELETE" });
        const payload = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(payload.message ?? "No se pudo eliminar el pendiente.");
        await loadPayables();
      } catch (error) {
        setErrorPayables(error instanceof Error ? error.message : "No se pudo eliminar el pendiente.");
      }
    }
    void run();
  }

  function togglePayablePaid(id: string, paid: boolean) {
    const paidAt = paid ? todayISODate() : null;
    async function run() {
      try {
        setErrorPayables(null);
        const response = await fetch(`/api/payables/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paidAt })
        });
        const payload = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(payload.message ?? "No se pudo actualizar el pendiente.");
        await loadPayables();
      } catch (error) {
        setErrorPayables(error instanceof Error ? error.message : "No se pudo actualizar el pendiente.");
      }
    }
    void run();
  }

  const payablesSorted = useMemo(() => {
    const items = [...payables];
    items.sort((a, b) => {
      const aStatus = derivePayableStatus(a, todayISO);
      const bStatus = derivePayableStatus(b, todayISO);
      const statusRank: Record<PayableStatus, number> = { VENCIDO: 0, PROXIMO: 1, PAGADO: 2 };
      const rank = statusRank[aStatus] - statusRank[bStatus];
      if (rank !== 0) return rank;
      return a.dueDate.localeCompare(b.dueDate);
    });
    return items;
  }, [payables, todayISO]);

  const isMobileTabs = true;

  return (
    <PageContainer className="space-y-6">
      <SectionHeader
        title="Pendientes"
        description="Controla lo que te deben y lo que debes pagar en una sola vista."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <SurfaceCard className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Me deben
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            {formatCurrency(meDebenTotal)}
          </p>
          <p className="mt-2 text-sm text-slate-600">Total pendiente por cobrar.</p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Debo pagar
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            {formatCurrency(deboPagarTotal)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Pendientes de pago reales: prestamos, cuotas y deudas propias marcadas como pendiente.
          </p>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-2 sm:p-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={activeTab === "me-deben" ? "default" : "secondary"}
            className={cn("h-10 flex-1 rounded-2xl text-sm", !isMobileTabs && "flex-initial")}
            onClick={() => setActiveTab("me-deben")}
          >
            <Users className="mr-2 h-4 w-4" />
            Me deben
          </Button>
          <Button
            type="button"
            variant={activeTab === "debo-pagar" ? "default" : "secondary"}
            className={cn("h-10 flex-1 rounded-2xl text-sm", !isMobileTabs && "flex-initial")}
            onClick={() => setActiveTab("debo-pagar")}
          >
            <CalendarClock className="mr-2 h-4 w-4" />
            Debo pagar
          </Button>
        </div>
      </SurfaceCard>

      {activeTab === "me-deben" ? (
        <SurfaceCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                Me deben
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Por cobrar este mes:{" "}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(porCobrarEsteMes)}
                </span>
                {debts?.totals.pendingCompanies ? (
                  <>
                    {" · "}
                    Empresas:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(debts.totals.pendingCompanies)}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              className="h-10 rounded-2xl px-4 text-sm"
              onClick={() => {
                setDebtError(null);
                setCreateDebtOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Registrar deuda
            </Button>
          </div>

          {loadingDebts ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : errorDebts ? (
            <div className="mt-4">
              <ErrorStateCard
                title="No se pudieron cargar los pendientes"
                description={errorDebts}
              />
            </div>
          ) : debts && (debts.people.length > 0 || debts.companies.length > 0) ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {debts.companies.map((company) => {
                const expanded = Boolean(expandedCompanyGroups[company.id]);
                const visibleEntries = expanded ? company.entries : company.entries.slice(0, 5);
                const totalPaid = Math.max(0, company.paidAmount);
                const totalGeneral = Math.max(0, company.totalAmount);
                const pending = Math.max(0, company.pendingAmount);
                const progressPct =
                  totalGeneral > 0 ? Math.max(0, Math.min(100, (totalPaid / totalGeneral) * 100)) : 0;
                const chipClass = toneForCompanyDebtStatus(company.status);
                const settleKey = `company:${company.id}`;
                const settling = Boolean(settlingKeys[settleKey]);

                return (
                  <SurfaceCard key={`company-${company.id}`} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold tracking-[-0.02em] text-slate-900">
                          {company.name}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          Empresa · Pendiente{" "}
                          <span className="font-semibold text-slate-900">{formatCurrency(pending)}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", chipClass)}>
                          {company.status === "PAGADO" ? "Pagada" : company.status === "ABONANDO" ? "Abonando" : "Pendiente"}
                        </span>
                        {pending > 0 ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-9 rounded-2xl px-3 text-sm"
                            disabled={settling}
                            onClick={() => {
                              const ok = window.confirm(`Marcar como pagado todo lo pendiente de ${company.name}?`);
                              if (!ok) return;
                              void settleCompanyDebt(company.id);
                            }}
                          >
                            {settling ? "Marcando..." : "Marcar pagado"}
                          </Button>
                        ) : null}
                        {company.entries.length > 5 ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-9 rounded-2xl px-3 text-sm"
                            onClick={() =>
                              setExpandedCompanyGroups((current) => ({
                                ...current,
                                [company.id]: !expanded
                              }))
                            }
                          >
                            {expanded ? (
                              <>
                                <ChevronUp className="mr-2 h-4 w-4" />
                                Contraer
                              </>
                            ) : (
                              <>
                                <ChevronDown className="mr-2 h-4 w-4" />
                                Expandir
                              </>
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Total</p>
                          <p className="mt-1 font-semibold text-slate-900">{formatCurrency(totalGeneral)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pagado</p>
                          <p className="mt-1 font-semibold text-emerald-700">{formatCurrency(totalPaid)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pendiente</p>
                          <p className="mt-1 font-semibold text-rose-700">{formatCurrency(pending)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Progreso</p>
                          <p className="mt-1 font-semibold text-slate-900">{Math.round(progressPct)}%</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={cn("h-full rounded-full", progressPct >= 100 ? "bg-emerald-500" : "bg-slate-900")}
                          style={{ width: `${Math.round(progressPct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {visibleEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-2xl border border-slate-200/70 bg-white/80 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {entry.notes ?? company.reason}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDate(entry.createdAt)}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold text-slate-900">
                              {formatCurrency(Math.max(0, entry.amount))}
                            </p>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              className="h-8 rounded-2xl px-3 text-xs"
                              disabled={!entry.transactionId || editTxLoading || loadingCategories}
                              onClick={() => {
                                if (!entry.transactionId) return;
                                void openEditTransaction(entry.transactionId);
                              }}
                            >
                              <PencilLine className="mr-2 h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className="h-8 rounded-2xl px-3 text-xs text-rose-600 hover:text-rose-700"
                              onClick={() => void deleteCompanyEntry(entry)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Eliminar
                            </Button>
                            {!entry.transactionId ? (
                              <span className="text-xs text-slate-500">
                                (Huérfano: movimiento original ya no existe)
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      {!expanded && company.entries.length > visibleEntries.length ? (
                        <p className="text-xs text-slate-500">
                          +{company.entries.length - visibleEntries.length} movimiento(s) más. Usa “Expandir” para verlos.
                        </p>
                      ) : null}
                    </div>
                  </SurfaceCard>
                );
              })}

              {meDebenGroups.map((group) => {
                const statusChip = toneForInstallmentStatus(group.status);
                const expanded = Boolean(expandedDebtorGroups[group.key]);
                const visibleItems = expanded ? group.items : group.items.slice(0, 5);
                const settleKey = `person-group:${group.items[0]?.id ?? group.key}`;
                const settling = Boolean(settlingKeys[settleKey]);
                const pendingIds = group.items
                  .filter((item) => Math.max(0, item.pendingAmount) > 0)
                  .map((item) => item.id);
                return (
                  <SurfaceCard key={group.key} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold tracking-[-0.02em] text-slate-900">
                          {group.name}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          {group.movementCount} movimiento(s) · Pendiente{" "}
                          <span className="font-semibold text-slate-900">{formatCurrency(group.pendingTotal)}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[12px] font-semibold",
                            statusChip
                          )}
                        >
                          {group.statusLabel}
                        </span>
                        {group.pendingTotal > 0 && pendingIds.length > 0 ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-9 rounded-2xl px-3 text-sm"
                            disabled={settling}
                            onClick={() => {
                              const ok = window.confirm(`Marcar como pagado todo lo pendiente de ${group.name}?`);
                              if (!ok) return;
                              void settlePersonDebts(pendingIds);
                            }}
                          >
                            {settling ? "Marcando..." : "Marcar pagado"}
                          </Button>
                        ) : null}
                        {group.items.length > 5 ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-9 rounded-2xl px-3 text-sm"
                            onClick={() =>
                              setExpandedDebtorGroups((current) => ({
                                ...current,
                                [group.key]: !expanded
                              }))
                            }
                          >
                            {expanded ? (
                              <>
                                <ChevronUp className="mr-2 h-4 w-4" />
                                Contraer
                              </>
                            ) : (
                              <>
                                <ChevronDown className="mr-2 h-4 w-4" />
                                Expandir
                              </>
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Total</p>
                          <p className="mt-1 font-semibold text-slate-900">{formatCurrency(group.totalGeneral)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pagado</p>
                          <p className="mt-1 font-semibold text-emerald-700">{formatCurrency(group.totalPaid)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pendiente</p>
                          <p className="mt-1 font-semibold text-rose-700">{formatCurrency(group.pendingTotal)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Progreso</p>
                          <p className="mt-1 font-semibold text-slate-900">{Math.round(group.progressPct)}%</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            group.progressPct >= 100 ? "bg-emerald-500" : "bg-slate-900"
                          )}
                          style={{ width: `${Math.round(group.progressPct)}%` }}
                        />
                      </div>
                      {group.progressPct >= 100 && group.pendingTotal <= 0 ? (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">
                          Cobrado completo
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-2">
                      {visibleItems.map((person) => {
                        const rowStatusChip = toneForInstallmentStatus(person.installmentStatus);
                        const hasCreditInstallments =
                          typeof person.creditInstallmentTotal === "number" &&
                          Number.isFinite(person.creditInstallmentTotal) &&
                          person.creditInstallmentTotal > 1;
                        const isInstallmentDebt =
                          (Boolean(person.isInstallmentDebt) || person.installmentCount > 1) && person.installmentCount > 1;
                        const isInstallmentItem = hasCreditInstallments || isInstallmentDebt;

                        const installmentTotal = hasCreditInstallments
                          ? person.creditInstallmentTotal ?? null
                          : isInstallmentDebt
                            ? person.installmentCount
                            : null;
                        const installmentCurrent = hasCreditInstallments
                          ? person.creditInstallmentCurrent ?? null
                          : isInstallmentDebt && person.installmentsPending > 0
                            ? Math.min(person.installmentCount, Math.max(1, person.paidInstallments + 1))
                            : isInstallmentDebt
                              ? person.installmentCount
                              : null;
                        const installmentLabel =
                          isInstallmentItem && typeof installmentCurrent === "number" && typeof installmentTotal === "number"
                            ? `Cuota ${installmentCurrent} de ${installmentTotal}`
                            : null;
                        const purchaseTotalAmount = isInstallmentItem
                          ? hasCreditInstallments
                            ? typeof person.creditPurchaseTotalAmount === "number" && Number.isFinite(person.creditPurchaseTotalAmount)
                              ? person.creditPurchaseTotalAmount
                              : person.totalAmount
                            : Math.max(0, person.totalAmount)
                          : null;
                        const rawInstallmentAmount = isInstallmentItem
                          ? hasCreditInstallments
                            ? typeof person.creditInstallmentAmount === "number" && Number.isFinite(person.creditInstallmentAmount)
                              ? person.creditInstallmentAmount
                              : null
                            : Math.max(0, person.installmentValue)
                          : null;
                        const derivedInstallmentAmount =
                          isInstallmentItem &&
                          typeof purchaseTotalAmount === "number" &&
                          Number.isFinite(purchaseTotalAmount) &&
                          typeof installmentTotal === "number" &&
                          Number.isFinite(installmentTotal) &&
                          installmentTotal > 0
                            ? Math.round(purchaseTotalAmount / installmentTotal)
                            : null;
                        const installmentAmount =
                          isInstallmentItem && typeof rawInstallmentAmount === "number" && rawInstallmentAmount > 0
                            ? rawInstallmentAmount
                            : derivedInstallmentAmount;
                        const installmentsRemaining =
                          hasCreditInstallments
                            ? typeof person.creditInstallmentsRemaining === "number" && Number.isFinite(person.creditInstallmentsRemaining)
                              ? person.creditInstallmentsRemaining
                              : typeof installmentTotal === "number" && typeof installmentCurrent === "number"
                                ? Math.max(0, installmentTotal - installmentCurrent)
                                : null
                            : isInstallmentDebt
                              ? Math.max(0, person.installmentsPending)
                              : null;

                        const primaryAmount = isInstallmentItem && (hasCreditInstallments || person.installmentsPending > 0)
                          ? (installmentAmount ?? Math.max(0, person.pendingAmount))
                          : Math.max(0, person.pendingAmount);

                        return (
                          <div
                            key={person.id}
                            className="rounded-2xl border border-slate-200/70 bg-white/80 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">
                                  {person.reason}
                                </p>
                                <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-900">
                                  {formatCurrency(primaryAmount)}
                                </p>
                                {isInstallmentItem ? (
                                  <div className="mt-1 text-xs text-slate-600">
                                    {installmentLabel ? <p className="font-semibold text-slate-700">{installmentLabel}</p> : null}
                                    {purchaseTotalAmount != null ? (
                                      <p>
                                        Total compra:{" "}
                                        <span className="font-semibold text-slate-800">{formatCurrency(purchaseTotalAmount)}</span>
                                      </p>
                                    ) : null}
                                    {typeof installmentsRemaining === "number" ? (
                                      <p className="text-slate-500">Restan {installmentsRemaining} cuotas</p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                    {person.nextInstallmentDate ? (
                                      <StatPill tone="neutral">
                                        Próxima: {formatDate(person.nextInstallmentDate)}
                                      </StatPill>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                                  rowStatusChip
                                )}
                              >
                                {person.installmentStatusLabel}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                className="h-9 rounded-2xl px-3 text-sm"
                                onClick={() => {
                                  setSelectedDebtorId(person.id);
                                  setPaymentForm({ amount: "", paidAt: todayISODate(), notes: "" });
                                  setPaymentError(null);
                                  setPaymentOpen(true);
                                }}
                              >
                                Registrar pago
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-9 rounded-2xl px-3 text-sm"
                                onClick={() => {
                                  setSelectedDebtorId(person.id);
                                  setDetailOpen(true);
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Detalle
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-9 rounded-2xl px-3 text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                onClick={() => {
                                  setSelectedDebtorId(person.id);
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        );
                      })}

                      {!expanded && group.items.length > visibleItems.length ? (
                        <p className="text-xs text-slate-500">
                          +{group.items.length - visibleItems.length} movimiento(s) más. Usa “Expandir” para verlos.
                        </p>
                      ) : null}
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyStateCard
                title="No tienes cobros pendientes registrados"
                description="Cuando registres un gasto como prestado o crees una deuda, aparecerá aquí."
                actionLabel="Registrar deuda"
                onAction={() => {
                  setDebtError(null);
                  setCreateDebtOpen(true);
                }}
              />
            </div>
          )}
        </SurfaceCard>
      ) : (
        <SurfaceCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                Debo pagar
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Registra compromisos de pago (tarjetas, prestamos o cuotas) y marca cuando los pagues.
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              className="h-10 rounded-2xl px-4 text-sm"
              onClick={openCreatePayable}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo
            </Button>
          </div>

          {loadingAccounts ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SkeletonCard />
            </div>
          ) : accounts.some((a) => a.type === "CREDITO") ? (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Tarjetas de credito
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Aqui ves lo que debes hoy por tarjeta. Si quieres marcarlo como pagado, crea un pendiente (queda con boton “Marcar pagado”).
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {accounts
                  .filter((a) => a.type === "CREDITO")
                  .map((card) => {
                    const dueDate = card.paymentDate ? card.paymentDate.slice(0, 10) : todayISODate();
                    const dueLabel = card.paymentDate ? `Vence: ${formatDate(card.paymentDate)}` : "Vencimiento: por confirmar";
                    const suggestedMin = card.minimumDue !== null ? Math.max(0, card.minimumDue) : null;
                    const suggestedTotal = card.totalBilled !== null ? Math.max(0, card.totalBilled) : null;
                    const suggested = creditCardSuggested.find((v) => v.id === card.id) ?? null;
                    const bestAmount = suggested?.amount ?? null;
                    const hasAny =
                      typeof bestAmount === "number" && Number.isFinite(bestAmount) ? bestAmount > 0 : false;
                    const alreadyTracked = Boolean(suggested?.alreadyTracked);

                    const primary = !hasAny
                      ? "Sin deuda pendiente"
                      : `Debes: ${formatCurrency(bestAmount as number)}`;
                  return (
                    <SurfaceCard key={card.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold tracking-[-0.02em] text-slate-900">
                            {card.name}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-600">{dueLabel}</p>
                          <p className={cn("mt-1 text-sm font-semibold", hasAny ? "text-rose-700" : "text-slate-900")}>
                            {primary}
                          </p>
                          {suggested?.label && hasAny ? (
                            <p className="mt-1 text-xs text-slate-500">{suggested.label}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {card.minimumDue !== null ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200">
                              Con estado
                            </span>
                          ) : null}
                          {alreadyTracked ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                              Pendiente creado
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {suggestedMin !== null && suggestedMin > 0 ? (
                          <Button
                            type="button"
                            variant="default"
                            className="h-9 rounded-2xl px-3 text-sm"
                            disabled={alreadyTracked}
                            onClick={() =>
                              openCreatePayablePrefill({
                                origin: `Pago minimo tarjeta: ${card.name}`,
                                amount: suggestedMin,
                                dueDate
                              })
                            }
                          >
                            Crear minimo
                          </Button>
                        ) : null}
                        {suggestedTotal !== null && suggestedTotal > 0 ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-9 rounded-2xl px-3 text-sm"
                            disabled={alreadyTracked}
                            onClick={() =>
                              openCreatePayablePrefill({
                                origin: `Pago total tarjeta: ${card.name}`,
                                amount: suggestedTotal,
                                dueDate
                              })
                            }
                          >
                            Crear total
                          </Button>
                        ) : null}
                        {suggestedMin === null &&
                        suggestedTotal === null &&
                        typeof suggested?.amount === "number" &&
                        Number.isFinite(suggested.amount) &&
                        suggested.amount > 0 ? (
                          <Button
                            type="button"
                            variant="default"
                            className="h-9 rounded-2xl px-3 text-sm"
                            disabled={alreadyTracked}
                            onClick={() =>
                              openCreatePayablePrefill({
                                origin: `Pago tarjeta: ${card.name}`,
                                amount: suggested?.amount ?? 0,
                                dueDate
                              })
                            }
                          >
                            Crear pendiente
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 rounded-2xl px-3 text-sm"
                          onClick={() => {
                            window.location.href = `/cuentas?card=${encodeURIComponent(card.id)}`;
                          }}
                        >
                          Ver tarjeta
                        </Button>
                      </div>
                    </SurfaceCard>
                  );
                })}
              </div>
            </div>
          ) : null}

          {loadingPayables ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : errorPayables ? (
            <div className="mt-4">
              <ErrorStateCard
                title="No se pudieron cargar tus pagos"
                description={errorPayables}
                onRetry={() => void loadPayables()}
              />
            </div>
          ) : payablesSorted.length === 0 ? (
            <div className="mt-4">
              <EmptyStateCard
                title="No tienes pagos pendientes"
                description="Agrega un compromiso para ver aquí lo que debes pagar."
                actionLabel="Agregar pendiente"
                onAction={openCreatePayable}
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {payablesSorted.map((item) => {
                const status = derivePayableStatus(item, todayISO);
                const statusClass = toneForPayableStatus(status);
                const isInstallmentPurchase =
                  item.isInstallmentPurchase === true ||
                  (typeof item.installmentTotal === "number" && item.installmentTotal > 1);
                const installmentCurrent =
                  typeof item.installmentCurrent === "number" ? item.installmentCurrent : null;
                const installmentTotal =
                  typeof item.installmentTotal === "number" ? item.installmentTotal : null;
                const installmentsRemaining =
                  typeof item.installmentsRemaining === "number"
                    ? item.installmentsRemaining
                    : typeof installmentCurrent === "number" && typeof installmentTotal === "number"
                      ? Math.max(0, installmentTotal - installmentCurrent)
                      : null;
                const installmentLabel =
                  isInstallmentPurchase && typeof installmentCurrent === "number" && typeof installmentTotal === "number"
                    ? `Cuota ${installmentCurrent} de ${installmentTotal}`
                    : isInstallmentPurchase
                      ? "Compra en cuotas"
                      : null;

                const secondary =
                  status === "PAGADO"
                    ? item.paidAt
                      ? `Pagado: ${formatDate(item.paidAt)}`
                      : "Pagado"
                    : `Vence: ${formatDate(item.dueDate)}`;

                const purchaseTotalAmount = isInstallmentPurchase
                  ? typeof item.purchaseTotalAmount === "number" && Number.isFinite(item.purchaseTotalAmount)
                    ? item.purchaseTotalAmount
                    : item.amount
                  : null;

                const installmentAmount = isInstallmentPurchase
                  ? typeof item.installmentAmount === "number" && Number.isFinite(item.installmentAmount)
                    ? item.installmentAmount
                    : typeof purchaseTotalAmount === "number" &&
                        Number.isFinite(purchaseTotalAmount) &&
                        typeof installmentTotal === "number" &&
                        Number.isFinite(installmentTotal) &&
                        installmentTotal > 0
                      ? Math.round(purchaseTotalAmount / installmentTotal)
                      : null
                  : null;

                const primaryAmount = isInstallmentPurchase ? (installmentAmount ?? item.amount) : item.amount;
                return (
                  <SurfaceCard key={item.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold tracking-[-0.02em] text-slate-900">
                          {item.origin}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          {installmentLabel ? `${installmentLabel} · ${secondary}` : secondary}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                          statusClass
                        )}
                      >
                        {status === "PAGADO" ? "Pagado" : status === "VENCIDO" ? "Vencido" : "Proximo"}
                      </span>
                    </div>

                    <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                      {formatCurrency(primaryAmount)}
                    </p>

                    {isInstallmentPurchase ? (
                      <div className="mt-1 text-sm text-slate-600">
                        {typeof purchaseTotalAmount === "number" && Number.isFinite(purchaseTotalAmount) ? (
                          <p>
                            Total compra:{" "}
                            <span className="font-semibold text-slate-800">{formatCurrency(purchaseTotalAmount)}</span>
                          </p>
                        ) : null}
                        {typeof installmentsRemaining === "number" ? (
                          <p className="text-xs text-slate-500">Restan {installmentsRemaining} cuotas</p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant={status === "PAGADO" ? "secondary" : "default"}
                        className="h-9 rounded-2xl px-3 text-sm"
                        onClick={() => togglePayablePaid(item.id, status !== "PAGADO")}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {status === "PAGADO" ? "Desmarcar" : "Marcar pagado"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 rounded-2xl px-3 text-sm"
                        onClick={() => openEditPayable(item)}
                      >
                        <PencilLine className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 rounded-2xl px-3 text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => deletePayable(item.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          )}

          {payablesModalOpen ? (
            <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
              <button
                type="button"
                aria-label="Cerrar"
                className="absolute inset-0 bg-black/45"
                onClick={closePayablesModal}
              />
              <SurfaceCard className="relative w-full max-w-lg bg-white/95 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.25)] ring-1 ring-slate-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                      {editingPayableId ? "Editar pago pendiente" : "Nuevo pago pendiente"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Se guarda por workspace para que no pierdas tus compromisos.
                    </p>
                  </div>
                  <Button type="button" variant="ghost" className="h-9 rounded-2xl" onClick={closePayablesModal}>
                    Cerrar
                  </Button>
                </div>

                <div className="mt-4 grid gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Origen
                    </p>
                    <Input
                      value={payableForm.origin}
                      onChange={(event) => setPayableForm((current) => ({ ...current, origin: event.target.value }))}
                      placeholder="Ej: Tarjeta Falabella, Prestamo, Cuota..."
                      className="mt-2"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Monto
                      </p>
                      <Input
                        value={payableForm.amount}
                        onChange={(event) => setPayableForm((current) => ({ ...current, amount: event.target.value }))}
                        inputMode="numeric"
                        placeholder="Ej: 45000"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Fecha pago
                      </p>
                      <Input
                        value={payableForm.dueDate}
                        onChange={(event) => setPayableForm((current) => ({ ...current, dueDate: event.target.value }))}
                        type="date"
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Nota (opcional)
                    </p>
                    <Input
                      value={payableForm.notes}
                      onChange={(event) => setPayableForm((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Ej: pago minimo, cuota 3/12..."
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" className="h-10 rounded-2xl px-4" onClick={closePayablesModal}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    className="h-10 rounded-2xl px-4"
                    onClick={upsertPayable}
                    disabled={Number(payableForm.amount || 0) <= 0}
                  >
                    Guardar
                  </Button>
                </div>
              </SurfaceCard>
            </div>
          ) : null}
        </SurfaceCard>
      )}

      {createDebtOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/45"
            onClick={() => setCreateDebtOpen(false)}
          />
          <SurfaceCard className="relative w-full max-w-lg bg-white/95 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.25)] ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  Registrar deuda
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Registra un cobro pendiente a una persona.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-2xl"
                onClick={() => setCreateDebtOpen(false)}
              >
                Cerrar
              </Button>
            </div>

            {debtError ? (
              <div className="mt-4">
              <ErrorStateCard title="No se pudo guardar" description={debtError} />
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Nombre
                </p>
                <Input
                  value={debtCreateForm.name}
                  onChange={(event) =>
                    setDebtCreateForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ej: Sebastian"
                  className="mt-2"
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Motivo
                </p>
                <Input
                  value={debtCreateForm.reason}
                  onChange={(event) =>
                    setDebtCreateForm((current) => ({ ...current, reason: event.target.value }))
                  }
                  placeholder="Ej: Computador en cuotas"
                  className="mt-2"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Monto total
                  </p>
                  <Input
                    value={debtCreateForm.totalAmount}
                    onChange={(event) =>
                      setDebtCreateForm((current) => ({
                        ...current,
                        totalAmount: event.target.value
                      }))
                    }
                    inputMode="numeric"
                    placeholder="Ej: 280000"
                    className="mt-2"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Fecha
                  </p>
                  <Input
                    value={debtCreateForm.startDate}
                    onChange={(event) =>
                      setDebtCreateForm((current) => ({
                        ...current,
                        startDate: event.target.value
                      }))
                    }
                    type="date"
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Nota (opcional)
                </p>
                <Input
                  value={debtCreateForm.notes}
                  onChange={(event) =>
                    setDebtCreateForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Ej: acuerdo de pago, detalles..."
                  className="mt-2"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-4"
                onClick={() => setCreateDebtOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-10 rounded-2xl px-4"
                disabled={debtSaving || debtCreateForm.name.trim().length < 3 || Number(debtCreateForm.totalAmount || 0) <= 0}
                onClick={async () => {
                  try {
                    setDebtSaving(true);
                    setDebtError(null);
                    const response = await fetch("/api/debts", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: debtCreateForm.name.trim(),
                        reason: debtCreateForm.reason.trim() || "Deuda manual",
                        totalAmount: Number(debtCreateForm.totalAmount || 0),
                        startDate: debtCreateForm.startDate || todayISODate(),
                        estimatedPayDate: null,
                        notes: debtCreateForm.notes.trim() || null
                      })
                    });
                    const payload = (await response.json()) as { message?: string };
                    if (!response.ok) throw new Error(payload.message ?? "No se pudo registrar la deuda.");
                    setCreateDebtOpen(false);
                    setDebtCreateForm({
                      name: "",
                      reason: "",
                      totalAmount: "",
                      startDate: todayISODate(),
                      notes: ""
                    });
                    await loadDebts();
                  } catch (error) {
                    setDebtError(error instanceof Error ? error.message : "No se pudo registrar la deuda.");
                  } finally {
                    setDebtSaving(false);
                  }
                }}
              >
                {debtSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {paymentOpen && selectedDebtor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/45"
            onClick={() => setPaymentOpen(false)}
          />
          <SurfaceCard className="relative w-full max-w-lg bg-white/95 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.25)] ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  Registrar pago
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedDebtor.name} · {formatCurrency(selectedDebtor.pendingAmount)} pendiente
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-2xl"
                onClick={() => setPaymentOpen(false)}
              >
                Cerrar
              </Button>
            </div>

            {paymentError ? (
              <div className="mt-4">
                <ErrorStateCard title="No se pudo registrar el pago" description={paymentError} />
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Monto
                  </p>
                  <Input
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm((current) => ({ ...current, amount: event.target.value }))
                    }
                    inputMode="numeric"
                    placeholder="Ej: 40000"
                    className="mt-2"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Fecha
                  </p>
                  <Input
                    value={paymentForm.paidAt}
                    onChange={(event) =>
                      setPaymentForm((current) => ({ ...current, paidAt: event.target.value }))
                    }
                    type="date"
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Nota (opcional)
                </p>
                <Input
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Ej: pago minimo, transferencia..."
                  className="mt-2"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-4"
                onClick={() => setPaymentOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-10 rounded-2xl px-4"
                disabled={paymentSaving || Number(paymentForm.amount || 0) <= 0}
                onClick={async () => {
                  try {
                    setPaymentSaving(true);
                    setPaymentError(null);
                    const response = await fetch(`/api/debts/${selectedDebtor.id}/payments`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        amount: Number(paymentForm.amount || 0),
                        paidAt: paymentForm.paidAt || todayISODate(),
                        notes: paymentForm.notes.trim() || null
                      })
                    });
                    const payload = (await response.json()) as { message?: string };
                    if (!response.ok) throw new Error(payload.message ?? "No se pudo registrar el pago.");
                    setPaymentOpen(false);
                    setSelectedDebtorId(null);
                    await loadDebts();
                  } catch (error) {
                    setPaymentError(error instanceof Error ? error.message : "No se pudo registrar el pago.");
                  } finally {
                    setPaymentSaving(false);
                  }
                }}
              >
                {paymentSaving ? "Guardando..." : "Registrar"}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {detailOpen && selectedDebtor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/45"
            onClick={() => setDetailOpen(false)}
          />
          <SurfaceCard className="relative w-full max-w-lg bg-white/95 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.25)] ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  {selectedDebtor.name}
                </p>
                <p className="mt-1 text-sm text-slate-600">{selectedDebtor.reason}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-2xl"
                onClick={() => setDetailOpen(false)}
              >
                Cerrar
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SurfaceCard className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Total
                </p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  {formatCurrency(selectedDebtor.totalAmount)}
                </p>
              </SurfaceCard>
              <SurfaceCard className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Pendiente
                </p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  {formatCurrency(selectedDebtor.pendingAmount)}
                </p>
              </SurfaceCard>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatPill tone="neutral">
                {selectedDebtor.isInstallmentDebt
                  ? `Cuotas: ${selectedDebtor.paidInstallments}/${selectedDebtor.installmentCount}`
                  : "Pago unico"}
              </StatPill>
              {selectedDebtor.nextInstallmentDate ? (
                <StatPill tone="neutral">
                  Proxima: {formatDate(selectedDebtor.nextInstallmentDate)}
                </StatPill>
              ) : null}
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold",
                  toneForInstallmentStatus(selectedDebtor.installmentStatus)
                )}
              >
                {selectedDebtor.installmentStatusLabel}
              </span>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-4"
                onClick={() => {
                  setDetailOpen(false);
                  setPaymentForm({ amount: "", paidAt: todayISODate(), notes: "" });
                  setPaymentError(null);
                  setPaymentOpen(true);
                }}
              >
                Registrar pago
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-10 rounded-2xl px-4"
                onClick={() => {
                  window.open(`/api/debts/${selectedDebtor.id}/export`, "_blank");
                }}
              >
                Descargar PDF
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {deleteConfirmOpen && selectedDebtor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/45"
            onClick={() => setDeleteConfirmOpen(false)}
          />
          <SurfaceCard className="relative w-full max-w-lg bg-white/95 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.25)] ring-1 ring-slate-100">
            <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
              ¿Eliminar este pendiente?
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Se eliminará la deuda de <span className="font-semibold text-slate-900">{selectedDebtor.name}</span>. Esta acción no se puede deshacer.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-4"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-10 rounded-2xl px-4"
                // Force destructive styling without introducing a new variant.
                // Button variants are intentionally small; keep semantics with color only here.
                style={{ backgroundColor: "#DC2626" }}
                disabled={deletingDebt}
                onClick={async () => {
                  try {
                    setDeletingDebt(true);
                    const response = await fetch(`/api/debts/${selectedDebtor.id}`, {
                      method: "DELETE"
                    });
                    const payload = (await response.json()) as { message?: string };
                    if (!response.ok) throw new Error(payload.message ?? "No se pudo eliminar la deuda.");
                    setDeleteConfirmOpen(false);
                    setDetailOpen(false);
                    setPaymentOpen(false);
                    setSelectedDebtorId(null);
                    await loadDebts();
                  } catch (error) {
                    setErrorDebts(error instanceof Error ? error.message : "No se pudo eliminar la deuda.");
                    setDeleteConfirmOpen(false);
                  } finally {
                    setDeletingDebt(false);
                  }
                }}
              >
                {deletingDebt ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      <EditTransactionModal
        open={editTxOpen}
        transaction={editTxOpen ? editTx : null}
        accounts={accounts}
        categories={categories}
        onOpenChange={(next) => {
          setEditTxOpen(next);
          if (!next) setEditTx(null);
        }}
        onSuccess={() => {
          void loadDebts();
          void loadAccounts();
          void loadPayables();
          void loadCreditHealth();
        }}
      />
    </PageContainer>
  );
}
