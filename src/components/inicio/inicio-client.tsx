"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Wallet2 } from "lucide-react";
import { NewTransactionModal } from "@/components/movimientos/new-transaction-modal";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { CalculatorWidget } from "@/components/inicio/calculator-widget";
import { MobileHomeStack } from "@/components/inicio/mobile-home-stack";
import { Button } from "@/components/ui/button";
import { EmptyStateCard, ErrorStateCard, Skeleton } from "@/components/ui/states";
import { SectionHeader } from "@/components/ui/section-header";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { resolveAccountAppearance } from "@/lib/accounts/account-appearance";
import { computeCreditCardMetrics } from "@/lib/accounts/credit-card";
import type { DashboardSnapshot } from "@/shared/types/dashboard";
import type { FinancialHealthResponse } from "@/shared/types/financial-health";
import type { FinancialInsightsResponse } from "@/shared/types/financial-insights";
import { FinancialInsightsPanel } from "@/components/inicio/financial-insights-panel";
import { useDashboardHeader } from "@/components/layout/dashboard-header-context";
import { DebtorsWidget, type DebtsSnapshot } from "@/components/inicio/widgets/debtors-widget";
import { UpcomingInstallmentsWidget } from "@/components/inicio/widgets/upcoming-installments-widget";
import { UpcomingPayablesWidget, type PayablesSnapshot } from "@/components/inicio/widgets/upcoming-payables-widget";
import { OverduePendingsWidget } from "@/components/inicio/widgets/overdue-pendings-widget";
import { RecentMovementsWidget } from "@/components/inicio/widgets/recent-movements-widget";
import { MonthFlowWidget } from "@/components/inicio/widgets/month-flow-widget";
import { FinancialHealthWidget } from "@/components/inicio/widgets/financial-health-widget";

const CALCULATOR_STORAGE_KEY = "mis-finanzas.mobile-calculator.v1";
const INICIO_WIDGET_STORAGE_KEY = "mis-finanzas.inicio.widgets.v1";

type InicioWidgetId =
  | "debtors"
  | "upcomingInstallments"
  | "upcomingPayables"
  | "overduePendings"
  | "recentMovements"
  | "financialHealth"
  | "monthFlow"
  | "calculator"
  | "aiFinancial";

type WidgetSize = "compact" | "standard" | "featured";

const defaultWidgetOrder: InicioWidgetId[] = [
  "debtors",
  "upcomingPayables",
  "overduePendings",
  "upcomingInstallments",
  "recentMovements",
  "monthFlow",
  "financialHealth",
  "calculator",
  "aiFinancial"
];

const widgetMeta: Record<
  InicioWidgetId,
  { label: string; description: string; category: "Esenciales" | "Control" | "Inteligencia" | "Planeación" }
> = {
  debtors: { label: "Mis deudores", description: "Personas que te deben y cuotas del mes.", category: "Esenciales" },
  upcomingInstallments: { label: "Cobros próximos", description: "Cuotas por cobrar y vencimientos.", category: "Control" },
  upcomingPayables: { label: "Cuotas próximas", description: "Pagos por hacer y próximos vencimientos.", category: "Control" },
  overduePendings: { label: "Vencidos", description: "Pendientes vencidos: por cobrar y por pagar.", category: "Control" },
  recentMovements: { label: "Movimientos recientes", description: "Últimos gastos e ingresos registrados.", category: "Esenciales" },
  monthFlow: { label: "Flujo del mes", description: "Ingresos, gastos y neto del período.", category: "Esenciales" },
  financialHealth: { label: "Salud financiera", description: "Semáforo, alertas y foco del mes.", category: "Inteligencia" },
  calculator: { label: "Calculadora", description: "Haz cuentas rápidas sin salir de Inicio.", category: "Control" },
  aiFinancial: { label: "IA financiera", description: "Análisis bajo demanda con tus datos reales.", category: "Planeación" }
};

type AccountItem = {
  id: string;
  balance: number;
  name: string;
  bank: string;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
  color: string | null;
  icon: string | null;
  appearanceMode: "auto" | "manual";
  creditLimit: number | null;
  closingDay: number | null;
  paymentDay: number | null;
};

type AccountsPayload = {
  items: AccountItem[];
};

type TransactionItem = {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: string;
  category: string;
};

type TransactionsPayload = {
  items: TransactionItem[];
};

function buildMonthGrid(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDayIndex = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDayIndex; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return { year, month, cells };
}

function keyByDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function InicioClient() {
  const { setMetric } = useDashboardHeader();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [accountsTotal, setAccountsTotal] = useState(0);
  const [movements, setMovements] = useState<TransactionItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const todayKey = keyByDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [calculatorInput, setCalculatorInput] = useState("");
  const [calculatorResult, setCalculatorResult] = useState<number | null>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [financialInsights, setFinancialInsights] = useState<FinancialInsightsResponse | null>(null);
  const [financialInsightsLoading, setFinancialInsightsLoading] = useState(false);
  const [financialInsightsError, setFinancialInsightsError] = useState<string | null>(null);
  const [financialHealth, setFinancialHealth] = useState<FinancialHealthResponse | null>(null);
  const [financialHealthLoading, setFinancialHealthLoading] = useState(false);
  const [financialHealthError, setFinancialHealthError] = useState<string | null>(null);
  const [debtsSnapshot, setDebtsSnapshot] = useState<DebtsSnapshot | null>(null);
  const [debtsLoading, setDebtsLoading] = useState(false);
  const [debtsError, setDebtsError] = useState<string | null>(null);
  const [payablesSnapshot, setPayablesSnapshot] = useState<PayablesSnapshot | null>(null);
  const [payablesLoading, setPayablesLoading] = useState(false);
  const [payablesError, setPayablesError] = useState<string | null>(null);
  const [widgetPanelOpen, setWidgetPanelOpen] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<InicioWidgetId[]>(defaultWidgetOrder);
  const [hiddenWidgets, setHiddenWidgets] = useState<InicioWidgetId[]>(defaultWidgetOrder);
  const [widgetsHydrated, setWidgetsHydrated] = useState(false);
  const [widgetSizes, setWidgetSizes] = useState<Record<InicioWidgetId, WidgetSize>>({
    debtors: "standard",
    upcomingInstallments: "standard",
    upcomingPayables: "standard",
    overduePendings: "compact",
    recentMovements: "standard",
    monthFlow: "compact",
    financialHealth: "standard",
    calculator: "compact",
    aiFinancial: "standard"
  });

  const monthGrid = useMemo(() => buildMonthGrid(new Date()), []);
  const movementDateKeys = useMemo(
    () => new Set(movements.map((item) => item.date.slice(0, 10))),
    [movements]
  );

  const loadFinancialHealth = useCallback(async (filters: DashboardSnapshot["filters"]) => {
    try {
      setFinancialHealthLoading(true);
      setFinancialHealthError(null);

      const params = new URLSearchParams();
      Object.entries(filters ?? {}).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });

      const response = await fetch(
        `/api/health/financial${params.toString() ? `?${params.toString()}` : ""}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "No se pudo cargar la salud financiera.");
      }

      const payload = (await response.json()) as FinancialHealthResponse;
      setFinancialHealth(payload);
    } catch (loadError) {
      setFinancialHealthError(
        loadError instanceof Error ? loadError.message : "No se pudo cargar la salud financiera."
      );
    } finally {
      setFinancialHealthLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardResponse, accountsResponse, transactionsResponse] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/transactions?take=12", { cache: "no-store" })
      ]);

      if (!dashboardResponse.ok || !accountsResponse.ok || !transactionsResponse.ok) {
        throw new Error("No se pudo cargar la vista de inicio.");
      }

      const dashboardPayload = (await dashboardResponse.json()) as DashboardSnapshot;
      const accountsPayload = (await accountsResponse.json()) as AccountsPayload;
      const transactionsPayload = (await transactionsResponse.json()) as TransactionsPayload;

      setSnapshot(dashboardPayload);
      setAccountsTotal(
        (accountsPayload.items ?? []).reduce(
          (acc, account) => (account.type === "CREDITO" ? acc : acc + account.balance),
          0
        )
      );
      setAccounts(accountsPayload.items ?? []);
      setMovements(transactionsPayload.items ?? []);
      void loadFinancialHealth(dashboardPayload.filters);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando inicio.");
    } finally {
      setLoading(false);
    }
  }, [loadFinancialHealth]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const activeWidgets = widgetOrder.filter((id) => !hiddenWidgets.includes(id));
    if (
      !activeWidgets.includes("debtors") &&
      !activeWidgets.includes("upcomingInstallments") &&
      !activeWidgets.includes("overduePendings")
    )
      return;
    let aborted = false;

    async function loadDebts() {
      try {
        setDebtsLoading(true);
        setDebtsError(null);
        const response = await fetch("/api/debts", { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message ?? "No se pudieron cargar los deudores.");
        }
        const payload = (await response.json()) as DebtsSnapshot;
        if (!aborted) setDebtsSnapshot(payload);
      } catch (loadError) {
        if (!aborted) {
          setDebtsSnapshot(null);
          setDebtsError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los deudores.");
        }
      } finally {
        if (!aborted) setDebtsLoading(false);
      }
    }

    void loadDebts();
    return () => {
      aborted = true;
    };
  }, [hiddenWidgets, widgetOrder]);

  useEffect(() => {
    const activeWidgets = widgetOrder.filter((id) => !hiddenWidgets.includes(id));
    if (!activeWidgets.includes("upcomingPayables") && !activeWidgets.includes("overduePendings")) return;
    let aborted = false;

    async function loadPayables() {
      try {
        setPayablesLoading(true);
        setPayablesError(null);
        const response = await fetch("/api/payables", { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message ?? "No se pudieron cargar tus cuotas por pagar.");
        }
        const payload = (await response.json()) as PayablesSnapshot;
        if (!aborted) setPayablesSnapshot(payload);
      } catch (loadError) {
        if (!aborted) {
          setPayablesSnapshot(null);
          setPayablesError(
            loadError instanceof Error ? loadError.message : "No se pudieron cargar tus cuotas por pagar."
          );
        }
      } finally {
        if (!aborted) setPayablesLoading(false);
      }
    }

    void loadPayables();
    return () => {
      aborted = true;
    };
  }, [hiddenWidgets, widgetOrder]);

  const incomes = Math.abs(snapshot?.kpis.incomes ?? 0);
  const expenses = Math.abs(snapshot?.kpis.expenses ?? 0);
  const availableTotal = accountsTotal;

  const selectedDayAmount = useMemo(() => {
    const dailyMovements = movements.filter((item) => item.date.startsWith(selectedDate));
    return dailyMovements.reduce((sum, item) => sum + item.amount, 0);
  }, [movements, selectedDate]);
  const selectedDayTotal = accountsTotal + selectedDayAmount;
  const selectedDateLabel = useMemo(() => {
    const parsed = new Date(selectedDate);
    return parsed.toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }, [selectedDate]);
  const onboardingInsightReady = Boolean(snapshot && accounts.length > 0 && movements.length > 0);
  const totalAvailableTone = availableTotal < 0 ? "negative" : "positive";

  const visibleWidgets = useMemo(
    () => widgetOrder.filter((id) => !hiddenWidgets.includes(id)),
    [hiddenWidgets, widgetOrder]
  );

  const categorizedWidgets = useMemo(() => {
    const groups: Record<string, InicioWidgetId[]> = {
      Esenciales: [],
      Control: [],
      Inteligencia: [],
      Planeación: []
    };

    defaultWidgetOrder.forEach((id) => {
      groups[widgetMeta[id].category].push(id);
    });

    return groups;
  }, []);

  const moveWidget = (id: InicioWidgetId, direction: "up" | "down") => {
    setWidgetsHydrated(true);
    setWidgetOrder((current) => {
      const idx = current.indexOf(id);
      if (idx === -1) return current;
      const target = direction === "up" ? Math.max(0, idx - 1) : Math.min(current.length - 1, idx + 1);
      const next = [...current];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const toggleWidget = (id: InicioWidgetId) => {
    setWidgetsHydrated(true);
    setHiddenWidgets((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const updateWidgetSize = (id: InicioWidgetId, size: WidgetSize) => {
    setWidgetsHydrated(true);
    setWidgetSizes((current) => ({ ...current, [id]: size }));
  };

  const renderAccountCard = (account: AccountItem) => {
    const appearance = resolveAccountAppearance(account);
    const credit = account.type === "CREDITO" ? computeCreditCardMetrics(account) : null;
    const primaryAmount = account.type === "CREDITO" && credit ? credit.debt : account.balance;
    const primaryTone =
      account.type === "CREDITO"
        ? credit && credit.debt > 0
          ? "text-rose-600"
          : "text-emerald-600"
        : account.balance >= 0
          ? "text-emerald-600"
          : "text-rose-600";

    return (
      <SurfaceCard
        key={account.id}
        variant="soft"
        className="aspect-[1/1] min-h-[164px] overflow-hidden bg-white p-3.5 sm:aspect-auto sm:min-h-[180px] sm:p-5"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {appearance.bankLabel || account.type}
              </p>
            </div>
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
              style={{
                borderColor: appearance.accentColor,
                backgroundColor: appearance.accentBackground
              }}
            >
              <span className="text-[13px]" style={{ color: appearance.accentColor }}>
                {appearance.glyph}
              </span>
            </span>
          </div>
          <p className="mt-2 line-clamp-2 min-h-[2.4rem] text-[13px] font-semibold leading-[1.22rem] tracking-[-0.02em] text-slate-900">
            {account.name}
          </p>
          <div className="flex flex-1 items-center">
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-[0.22em] text-slate-500">
                {account.type === "CREDITO" ? "Deuda actual" : "Saldo disponible"}
              </p>
              <p
                className={`text-[clamp(1.4rem,4.6vw,1.85rem)] font-semibold leading-none tracking-[-0.04em] ${primaryTone}`}
              >
                {formatCurrency(primaryAmount)}
              </p>
              {account.type === "CREDITO" && credit ? (
                <p className="text-[10px] font-medium text-slate-500">
                  {credit.creditLimit
                    ? `Disponible ${formatCurrency(credit.available ?? 0)}`
                    : "Configura cupo"}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </SurfaceCard>
    );
  };

  useEffect(() => {
    if (loading || !snapshot) {
      setMetric(null);
      return;
    }

    setMetric({
      label: "Total disponible real",
      value: formatCurrency(availableTotal),
      detail: "Suma real de todas tus cuentas registradas.",
      tone: totalAvailableTone
    });

    return () => setMetric(null);
  }, [availableTotal, loading, setMetric, totalAvailableTone, snapshot]);

  const appendCalculatorSymbol = (symbol: string) => {
    setCalculatorInput((prev) => `${prev}${symbol}`);
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CALCULATOR_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        input?: string;
        result?: number | null;
      };
      if (typeof parsed.input === "string") setCalculatorInput(parsed.input);
      if (typeof parsed.result === "number" || parsed.result === null) {
        setCalculatorResult(parsed.result ?? null);
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(INICIO_WIDGET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        order?: InicioWidgetId[];
        hidden?: InicioWidgetId[];
        sizes?: Record<InicioWidgetId, WidgetSize>;
      };

      const storedOrder = parsed.order?.length
        ? parsed.order.filter((id): id is InicioWidgetId => defaultWidgetOrder.includes(id))
        : null;
      const mergedOrder = storedOrder
        ? [...storedOrder, ...defaultWidgetOrder.filter((id) => !storedOrder.includes(id))]
        : defaultWidgetOrder;
      if (storedOrder) {
        setWidgetOrder(mergedOrder);
      }

      const storedHidden = parsed.hidden
        ? parsed.hidden.filter((id): id is InicioWidgetId => defaultWidgetOrder.includes(id))
        : null;
      if (storedHidden !== null) {
        const newIds = storedOrder ? mergedOrder.filter((id) => !storedOrder.includes(id)) : [];
        setHiddenWidgets(Array.from(new Set([...storedHidden, ...newIds])));
      } else if (storedOrder) {
        // No hidden state stored: keep existing widgets visible and hide only newly added widgets.
        const newIds = mergedOrder.filter((id) => !storedOrder.includes(id));
        setHiddenWidgets(newIds);
      }
      const sizes = parsed.sizes;
      if (sizes) {
        setWidgetSizes((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.entries(sizes).filter(
              ([key, value]) =>
                defaultWidgetOrder.includes(key as InicioWidgetId) &&
                (["compact", "standard", "featured"] as WidgetSize[]).includes(value as WidgetSize)
            )
          )
        }));
      }
    } catch {
      // noop
    } finally {
      setWidgetsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!widgetsHydrated) return;
    try {
      window.localStorage.setItem(
        INICIO_WIDGET_STORAGE_KEY,
        JSON.stringify({ order: widgetOrder, hidden: hiddenWidgets, sizes: widgetSizes })
      );
    } catch {
      // noop
    }
  }, [hiddenWidgets, widgetOrder, widgetSizes, widgetsHydrated]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CALCULATOR_STORAGE_KEY,
        JSON.stringify({
          input: calculatorInput,
          result: calculatorResult
        })
      );
    } catch {
      // noop
    }
  }, [calculatorInput, calculatorResult]);

  const evaluateExpression = (value: string) => {
    if (!value.trim()) return null;
    const sanitized = value.replace(/[^0-9.+\-*/() ]/g, "");
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${sanitized}`)();
      return typeof result === "number" && Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  };

  const handleCalculatorEquals = () => {
    const result = evaluateExpression(calculatorInput);
    setCalculatorResult(result);
  };

  const handleCalculatorClear = () => {
    setCalculatorInput("");
    setCalculatorResult(null);
  };

  const handleCalculatorDelete = () => {
    setCalculatorInput((prev) => prev.slice(0, -1));
  };

  async function handleAnalyzeFinancials() {
    try {
      setFinancialInsightsLoading(true);
      setFinancialInsightsError(null);

      const response = await fetch("/api/ai/financial-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filters: snapshot?.filters ?? undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "No se pudo generar el análisis.");
      }

      const payload = (await response.json()) as FinancialInsightsResponse;
      setFinancialInsights(payload);
    } catch (submitError) {
      setFinancialInsightsError(
        submitError instanceof Error ? submitError.message : "No se pudo generar el análisis."
      );
    } finally {
      setFinancialInsightsLoading(false);
    }
  }

  return (
    <div className="space-y-5 pb-20 sm:space-y-6">
      <SectionHeader
        eyebrow="Inicio"
        title="Tu dinero en un vistazo"
        description="Cuentas, calendario, movimientos y análisis en una sola vista clara y mobile-first."
        actions={
          <StatPill tone="premium" icon={<Wallet2 className="h-3.5 w-3.5" />}>
            Vista diaria
          </StatPill>
        }
      />

      <MobileHomeStack
        onOpenCalculator={() => setCalculatorOpen(true)}
        onOpenTransaction={() => setOpenModal(true)}
      />

      <OnboardingBanner
        accountsCount={accounts.length}
        movementsCount={movements.length}
        insightsReady={onboardingInsightReady}
      />

      {error ? (
        <ErrorStateCard title="No se pudo cargar la vista" description={error} onRetry={() => void loadData()} />
      ) : null}

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.length === 0 ? (
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <EmptyStateCard
              title="Aún no tienes cuentas"
              description="Crea tu primera billetera o tarjeta para registrar movimientos."
              actionLabel="Crear cuenta"
              onAction={() => (window.location.href = "/cuentas")}
            />
          </div>
        ) : null}
        {accounts.map((account) => renderAccountCard(account))}
      </section>
      <SurfaceCard className="relative overflow-hidden border-border/80 bg-white text-slate-900 shadow-[0_20px_46px_rgba(15,23,42,0.08)]">
        <div
          className={`absolute inset-x-0 top-0 h-1 ${
            availableTotal >= 0 ? "bg-emerald-500/80" : "bg-rose-500/80"
          }`}
        />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Saldo total</p>
          <p
            className={`mt-2 text-4xl font-semibold tracking-tight sm:text-[44px] ${
              availableTotal >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {loading ? "..." : formatCurrency(availableTotal)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Suma real de todas tus cuentas registradas.
          </p>
        </div>
      </SurfaceCard>

      <SurfaceCard variant="soft" padding="sm" className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tus widgets</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
            Personaliza tu panel con la información que más te importa.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setWidgetPanelOpen(true)}
          className="h-10 shrink-0 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] hover:bg-slate-800"
        >
          Agregar widgets
        </Button>
      </SurfaceCard>

      {widgetPanelOpen ? (
        <SurfaceCard variant="soft" padding="sm" className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Personalización</p>
              <p className="mt-1 text-base font-semibold text-slate-900">Elige tus widgets</p>
              <p className="mt-1 text-sm text-slate-600">
                Activa, ordena y define el tamaño de tu panel.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 rounded-full"
              onClick={() => setWidgetPanelOpen(false)}
            >
              Cerrar
            </Button>
          </div>

          <div className="space-y-4">
            {Object.entries(categorizedWidgets).map(([category, ids]) => (
              <div key={category} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {category}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ids.map((id) => {
                    const isHidden = hiddenWidgets.includes(id);
                    const size = widgetSizes[id] ?? "standard";
                    return (
                      <div
                        key={id}
                        className={`rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-[0_10px_22px_rgba(15,23,42,0.05)] ${
                          isHidden ? "opacity-60" : "opacity-100"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{widgetMeta[id].label}</p>
                            <p className="mt-1 text-xs text-slate-500">{widgetMeta[id].description}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Button
                              type="button"
                              variant={isHidden ? "secondary" : "default"}
                              className={`h-8 rounded-full px-3 text-xs font-semibold ${
                                isHidden ? "" : "bg-slate-900 text-white hover:bg-slate-800"
                              }`}
                              onClick={() => toggleWidget(id)}
                            >
                              {isHidden ? "Activar" : "Desactivar"}
                            </Button>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-8 w-8 rounded-full p-0 text-slate-500"
                                onClick={() => moveWidget(id, "up")}
                                aria-label="Subir"
                              >
                                ↑
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-8 w-8 rounded-full p-0 text-slate-500"
                                onClick={() => moveWidget(id, "down")}
                                aria-label="Bajar"
                              >
                                ↓
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Tamaño
                          </span>
                          {(["compact", "standard", "featured"] as WidgetSize[]).map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => updateWidgetSize(id, option)}
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                size === option
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              {option === "featured" ? "Destacado" : option === "standard" ? "Estándar" : "Compacto"}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      <div className="space-y-4">
        {visibleWidgets.length === 0 ? (
          <EmptyStateCard
            title="Tu panel está listo para personalizar"
            description="Agrega widgets para ver aquí tu información más importante."
            actionLabel="Elegir widgets"
            onAction={() => setWidgetPanelOpen(true)}
            className="shadow-none"
          />
        ) : null}

        {visibleWidgets.map((id) => {
          const size = widgetSizes[id] ?? "standard";

          if (id === "debtors") {
            return (
              <DebtorsWidget
                key={id}
                data={debtsSnapshot}
                loading={debtsLoading}
                error={debtsError}
                size={size}
                onViewAll={() => (window.location.href = "/pendientes")}
              />
            );
          }

          if (id === "upcomingInstallments") {
            return (
              <UpcomingInstallmentsWidget
                key={id}
                data={debtsSnapshot}
                loading={debtsLoading}
                error={debtsError}
                size={size}
                onViewAll={() => (window.location.href = "/pendientes")}
              />
            );
          }

          if (id === "upcomingPayables") {
            return (
              <UpcomingPayablesWidget
                key={id}
                data={payablesSnapshot}
                loading={payablesLoading}
                error={payablesError}
                size={size}
                onViewAll={() => (window.location.href = "/pendientes?tab=debo-pagar")}
              />
            );
          }

          if (id === "overduePendings") {
            return (
              <OverduePendingsWidget
                key={id}
                debts={debtsSnapshot}
                debtsLoading={debtsLoading}
                debtsError={debtsError}
                payables={payablesSnapshot}
                payablesLoading={payablesLoading}
                payablesError={payablesError}
                size={size}
                onViewAll={() => (window.location.href = "/pendientes")}
              />
            );
          }

          if (id === "recentMovements") {
            return (
              <RecentMovementsWidget
                key={id}
                items={movements}
                loading={loading}
                size={size}
                accounts={accounts}
                onCreate={() => setOpenModal(true)}
              />
            );
          }

          if (id === "monthFlow") {
            return (
              <MonthFlowWidget
                key={id}
                incomes={incomes}
                expenses={expenses}
                loading={loading}
                size={size}
              />
            );
          }

          if (id === "financialHealth") {
            return (
              <FinancialHealthWidget
                key={id}
                data={financialHealth}
                loading={financialHealthLoading}
                error={financialHealthError}
                size={size}
                onRetry={() => void loadData()}
              />
            );
          }

          if (id === "calculator") {
            return (
              <SurfaceCard key={id} variant="soft" padding="sm" className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Calculadora</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">Haz cuentas rápido</p>
                    <p className="mt-1 text-sm text-slate-600">No pierdes el estado al cerrar.</p>
                  </div>
                  <Button type="button" variant="secondary" className="rounded-full" onClick={() => setCalculatorOpen(true)}>
                    Abrir
                  </Button>
                </div>
                {size !== "compact" ? (
                  <CalculatorWidget
                    calculatorInput={calculatorInput}
                    calculatorResult={calculatorResult}
                    onAppend={appendCalculatorSymbol}
                    onClear={handleCalculatorClear}
                    onDelete={handleCalculatorDelete}
                    onEquals={handleCalculatorEquals}
                    compact
                  />
                ) : null}
              </SurfaceCard>
            );
          }

          if (id === "aiFinancial") {
            return (
              <div key={id} className="space-y-3">
                <SurfaceCard variant="highlight" padding="sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">IA financiera</p>
                      <p className="text-base font-semibold text-slate-900">
                        Pulsa para revisar tu situación financiera
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAnalyzeFinancials}
                      disabled={financialInsightsLoading}
                      className="h-11 rounded-2xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(37,99,235,0.22)]"
                    >
                      {financialInsightsLoading ? "Analizando..." : "Analizar"}
                    </Button>
                  </div>
                </SurfaceCard>
                <FinancialInsightsPanel
                  loading={financialInsightsLoading}
                  error={financialInsightsError}
                  response={financialInsights}
                />
              </div>
            );
          }

          return null;
        })}
      </div>

      <NewTransactionModal
        open={openModal}
        onOpenChange={setOpenModal}
        onSuccess={() => {
          void loadData();
        }}
      />

      {calculatorOpen ? (
        <div className="fixed inset-0 z-[72] flex items-end justify-center bg-slate-950/36 p-0 sm:items-center sm:p-4">
          <div className="glass-surface safe-pb w-full max-h-[88vh] overflow-y-auto rounded-t-[28px] p-4 animate-fade-up ring-1 ring-white/35 sm:max-w-md sm:rounded-[32px] sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Calculadora
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Calcula sin salir de Inicio</h3>
              </div>
              <button
                type="button"
                onClick={() => setCalculatorOpen(false)}
                className="tap-feedback rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                aria-label="Cerrar calculadora"
              >
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>
            <CalculatorWidget
              calculatorInput={calculatorInput}
              calculatorResult={calculatorResult}
              onAppend={appendCalculatorSymbol}
              onClear={handleCalculatorClear}
              onDelete={handleCalculatorDelete}
              onEquals={handleCalculatorEquals}
              compact
            />
          </div>
        </div>
      ) : null}

    </div>
  );
}
