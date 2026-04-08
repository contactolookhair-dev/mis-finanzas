"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Check,
  CreditCard,
  Sparkles,
  Wallet2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { StatPill } from "@/components/ui/stat-pill";
import { Skeleton } from "@/components/ui/states";

type AccountItem = {
  id: string;
  name: string;
  bank: string | null;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
};

type CategoryItem = {
  id: string;
  name: string;
};

type DemoAccountContext = {
  segment: "personal" | "business";
  label: string;
};

type ExpenseOwner = "MINE" | "PERSON" | "COMPANY";
type CreditPayIntent = "PAY_CARD" | "JUST_CREDIT";
type CreditPayWhat = "INSTALLMENT" | "PARTIAL_DEBT" | "TOTAL";
type CreditImpactType = "consume_cupo" | "no_consume_cupo" | "pago_tarjeta" | "ajuste_manual";
type PaymentMode = "single" | "installments";
type CreditInstallmentTargetType = "PERSON" | "COMPANY";

type WizardState = {
  accountId: string | null;
  amount: string;
  movementType: "GASTO" | "INGRESO" | "TRANSFERENCIA" | null;
  categoryId: string | null;
  note: string;
  expenseOwner: ExpenseOwner | null;
  personName: string | null;
  personId: string | null;
  companyName: string | null;
  companyId: string | null;
  creditPayIntent: CreditPayIntent | null;
  creditPayWhat: CreditPayWhat | null;
  creditInstallmentTargetType: CreditInstallmentTargetType | null;
  creditInstallmentTargetId: string | null;
  creditInstallmentTargetName: string | null;
  creditImpactType: CreditImpactType | null;
  paymentMode: PaymentMode;
  cuotaActual: string;
  cuotaTotal: string;
  purchaseInstallmentError: string | null;
};

type StepKey =
  | "welcome"
  | "account"
  | "amount"
  | "type"
  | "creditExpenseImpact"
  | "creditExpensePayment"
  | "creditIncomeImpact"
  | "owner"
  | "person"
  | "company"
  | "creditPayIntent"
  | "creditPayWhat"
  | "creditInstallmentTarget"
  | "category"
  | "note"
  | "review";

type WizardStep = {
  key: StepKey;
  title: string;
};

const STEP_TITLES: Record<StepKey, string> = {
  welcome: "Bienvenida",
  account: "¿Qué cuenta usarás?",
  amount: "¿Cuál es el monto?",
  type: "¿Qué estás registrando?",
  creditExpenseImpact: "Impacto en el cupo",
  creditExpensePayment: "Forma de pago",
  creditIncomeImpact: "Impacto en la tarjeta",
  owner: "¿A quién corresponde este gasto?",
  person: "¿Quién te debe este gasto?",
  company: "¿Qué empresa debe cubrir este gasto?",
  creditPayIntent: "¿Este dinero lo estás usando para pagar la tarjeta?",
  creditPayWhat: "¿Qué quieres pagar?",
  creditInstallmentTarget: "¿A quién corresponde esta cuota?",
  category: "¿En qué categoría cae?",
  note: "¿Quieres agregar un detalle?",
  review: "Revisa antes de confirmar"
};

function getMovementTypeLabel(type: WizardState["movementType"] | null) {
  if (type === "GASTO") return "Gasto";
  if (type === "INGRESO") return "Ingreso";
  if (type === "TRANSFERENCIA") return "Transferencia";
  return null;
}

function getExpenseOwnerLabel(owner: ExpenseOwner | null) {
  if (owner === "MINE") return "Es mío";
  if (owner === "PERSON") return "De otra persona";
  if (owner === "COMPANY") return "De una empresa";
  return null;
}

function getCreditPayWhatLabel(what: CreditPayWhat | null) {
  if (what === "INSTALLMENT") return "Una cuota";
  if (what === "PARTIAL_DEBT") return "Parte de la deuda";
  if (what === "TOTAL") return "Pago total";
  return null;
}

function getCreditInstallmentTargetTypeLabel(value: CreditInstallmentTargetType | null) {
  if (value === "PERSON") return "Persona";
  if (value === "COMPANY") return "Empresa";
  return null;
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = `${d.getDate()}`.padStart(2, "0");
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function getCreditImpactLabel(value: CreditImpactType | null) {
  if (value === "consume_cupo") return "Compra nueva · consume cupo";
  if (value === "no_consume_cupo") return "Ya considerada · solo historial";
  if (value === "pago_tarjeta") return "Pago de tarjeta · libera cupo";
  if (value === "ajuste_manual") return "Ajuste manual · corrige deuda";
  return null;
}

function normalizeAmountInput(value: string) {
  // Keep it simple for demo: allow digits and one leading minus (income/transfer may be positive anyway).
  const cleaned = value.replace(/[^\d-]/g, "");
  if (cleaned.startsWith("-")) {
    return `-${cleaned.slice(1).replace(/-/g, "")}`;
  }
  return cleaned.replace(/-/g, "");
}

function parseAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeKey(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isOwnershipLikeCategoryName(input: string, owner: ExpenseOwner | null) {
  const name = normalizeKey(input);
  if (!name) return false;

  const base = new Set(["empresa", "negocio", "personal", "persona", "prestado", "propio", "mio", "mia"]);
  // If the user already picked an ownership, be stricter to avoid duplicity.
  if (owner === "COMPANY") {
    base.add("empresa");
    base.add("negocio");
  }
  if (owner === "MINE") {
    base.add("personal");
    base.add("mio");
    base.add("mia");
  }
  if (owner === "PERSON") {
    base.add("persona");
  }

  for (const token of base) {
    // Exact match or starts-with is enough for our demo (e.g. "empresa" / "empresa gastos").
    if (name === token || name.startsWith(`${token} `)) return true;
  }
  return false;
}

function getDemoAccountContext(account: AccountItem | null): DemoAccountContext {
  const name = normalizeKey(account?.name ?? "");
  const bank = normalizeKey(account?.bank ?? "");
  const looksBusiness =
    /\bempresa\b/.test(name) ||
    /\bnegocio\b/.test(name) ||
    /\bbusiness\b/.test(name) ||
    /\bempresa\b/.test(bank) ||
    /\bnegocio\b/.test(bank);

  if (looksBusiness) {
    return { segment: "business", label: "Empresa" };
  }
  return { segment: "personal", label: "Personal" };
}

function getSuggestedCategoryKeys(context: DemoAccountContext, owner: ExpenseOwner | null): string[] {
  // Demo-only heuristics: we just prioritize common categories by segment.
  if (owner === "COMPANY") {
    return ["marketing", "publicidad", "software", "apps", "servicios", "hogar", "transporte"];
  }
  if (owner === "PERSON") {
    return ["transporte", "comida", "hogar", "servicios", "salud", "otros"];
  }
  if (owner === "MINE") {
    return ["comida", "supermercado", "transporte", "salud", "suscripciones", "hogar", "combustible"];
  }
  if (context.segment === "business") {
    return [
      "publicidad",
      "marketing",
      "software",
      "apps",
      "servicios",
      "hogar", // many users track office/home as "hogar"
      "transporte"
    ];
  }
  return ["comida", "supermercado", "transporte", "salud", "suscripciones", "hogar", "combustible"];
}

function buildDynamicSteps(input: {
  accountType: AccountItem["type"] | null;
  movementType: WizardState["movementType"] | null;
  creditPayIntent: CreditPayIntent | null;
  expenseOwner: ExpenseOwner | null;
  creditPayWhat: CreditPayWhat | null;
  lockedMovementType: boolean;
}): WizardStep[] {
  const steps: WizardStep[] = [
    { key: "welcome", title: STEP_TITLES.welcome },
    { key: "account", title: STEP_TITLES.account },
    { key: "amount", title: STEP_TITLES.amount }
  ];
  if (!input.lockedMovementType) {
    steps.push({ key: "type", title: STEP_TITLES.type });
  }

  const accountType = input.accountType;
  const movementType = input.movementType;
  const expenseOwner = input.expenseOwner;
  const creditPayIntent = input.creditPayIntent;

  // If the user hasn't picked these yet, keep the "default" path for continuity.
  if (!accountType || !movementType) {
    return [
      ...steps,
      { key: "category", title: STEP_TITLES.category },
      { key: "note", title: STEP_TITLES.note },
      { key: "review", title: STEP_TITLES.review }
    ];
  }

  const isTransfer = movementType === "TRANSFERENCIA";
  if (isTransfer) {
    return [...steps, { key: "note", title: STEP_TITLES.note }, { key: "review", title: STEP_TITLES.review }];
  }

  const isExpense = movementType === "GASTO";
  const isIncome = movementType === "INGRESO";

  // Credit card special handling.
  if (accountType === "CREDITO") {
    if (isExpense) {
      const ownerPick: WizardStep[] = [{ key: "owner", title: STEP_TITLES.owner }];
      const counterpartyStep: WizardStep[] =
        expenseOwner === "PERSON"
          ? [{ key: "person", title: STEP_TITLES.person }]
          : expenseOwner === "COMPANY"
            ? [{ key: "company", title: STEP_TITLES.company }]
            : [];
      return [
        ...steps,
        { key: "creditExpenseImpact", title: STEP_TITLES.creditExpenseImpact },
        { key: "creditExpensePayment", title: STEP_TITLES.creditExpensePayment },
        ...ownerPick,
        ...counterpartyStep,
        { key: "category", title: STEP_TITLES.category },
        { key: "note", title: STEP_TITLES.note },
        { key: "review", title: STEP_TITLES.review }
      ];
    }
    if (isIncome) {
      const payIntentStep: WizardStep[] = [{ key: "creditPayIntent", title: STEP_TITLES.creditPayIntent }];
      const payWhatStep: WizardStep[] =
        creditPayIntent === "PAY_CARD" ? [{ key: "creditPayWhat", title: STEP_TITLES.creditPayWhat }] : [];
      const installmentTargetStep: WizardStep[] =
        creditPayIntent === "PAY_CARD" && input.creditPayWhat === "INSTALLMENT"
          ? [{ key: "creditInstallmentTarget", title: STEP_TITLES.creditInstallmentTarget }]
          : [];
      const impactStep: WizardStep[] =
        creditPayIntent === "PAY_CARD" ? [{ key: "creditIncomeImpact", title: STEP_TITLES.creditIncomeImpact }] : [];
      return [
        ...steps,
        ...payIntentStep,
        ...payWhatStep,
        ...installmentTargetStep,
        ...impactStep,
        { key: "note", title: STEP_TITLES.note },
        { key: "review", title: STEP_TITLES.review }
      ];
    }
  }

  // Debit / Cash.
  if (isIncome) {
    return [...steps, { key: "note", title: STEP_TITLES.note }, { key: "review", title: STEP_TITLES.review }];
  }

  // Expense path for debit/cash.
  if (isExpense) {
    const ownerPick: WizardStep[] = [{ key: "owner", title: STEP_TITLES.owner }];
    const counterpartyStep: WizardStep[] =
      expenseOwner === "PERSON"
        ? [{ key: "person", title: STEP_TITLES.person }]
        : expenseOwner === "COMPANY"
          ? [{ key: "company", title: STEP_TITLES.company }]
          : [];
    return [
      ...steps,
      ...ownerPick,
      ...counterpartyStep,
      { key: "category", title: STEP_TITLES.category },
      { key: "note", title: STEP_TITLES.note },
      { key: "review", title: STEP_TITLES.review }
    ];
  }

  return [...steps, { key: "note", title: STEP_TITLES.note }, { key: "review", title: STEP_TITLES.review }];
}

type WizardMode = "demo" | "real";

type Props = {
  mode?: WizardMode;
  onDone?: () => void;
  onSaved?: () => void;
  initialMovementType?: "GASTO" | "INGRESO";
};

export function AddExpenseWizard({ mode = "demo", onDone, onSaved, initialMovementType }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastStepKeyRef = useRef<StepKey>("welcome");

  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  type PersonOption = { id: string; name: string; totalAmount: number; notes: string | null };
  type CompanyOption = { id: string; name: string };

  const [people, setPeople] = useState<PersonOption[]>([
    { id: "demo-person:sebastian-molina", name: "Sebastian Molina", totalAmount: 0, notes: null },
    { id: "demo-person:darling-molina", name: "Darling Molina", totalAmount: 0, notes: null },
    { id: "demo-person:juan-golindano", name: "Juan Golindano", totalAmount: 0, notes: null },
    { id: "demo-person:daniel-rebeco", name: "Daniel Rebeco", totalAmount: 0, notes: null }
  ]);
  const [companies, setCompanies] = useState<CompanyOption[]>([
    { id: "demo-company:detalles-chile", name: "Detalles Chile" },
    { id: "demo-company:house-of-hair", name: "House of Hair" },
    { id: "demo-company:look-hair", name: "Look Hair Extensions" },
    { id: "demo-company:wom", name: "Wom" }
  ]);
  const [personQuery, setPersonQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [recentPersonIds, setRecentPersonIds] = useState<string[]>([]);
  const [recentCompanyIds, setRecentCompanyIds] = useState<string[]>([]);

  const [creditInstallmentCandidates, setCreditInstallmentCandidates] = useState<{
    loading: boolean;
    error: string | null;
    txItems: Array<{
      id: string;
      description: string;
      date: string;
      amount: number;
      isInstallmentPurchase?: boolean;
      cuotaActual?: number | null;
      cuotaTotal?: number | null;
    }>;
    people: Array<{ id: string; name: string; purchasesCount: number; sourceTxIds: string[] }>;
    companies: Array<{ id: string; name: string; purchasesCount: number; sourceTxIds: string[] }>;
  }>({
    loading: false,
    error: null,
    txItems: [],
    people: [],
    companies: []
  });

  const [state, setState] = useState<WizardState>({
    accountId: null,
    amount: "",
    movementType: initialMovementType ?? "GASTO",
    categoryId: null,
    note: "",
    expenseOwner: null,
    personName: null,
    personId: null,
    companyName: null,
    companyId: null,
    creditPayIntent: null,
    creditPayWhat: null,
    creditInstallmentTargetType: null,
    creditInstallmentTargetId: null,
    creditInstallmentTargetName: null,
    creditImpactType: null,
    paymentMode: "single",
    cuotaActual: "",
    cuotaTotal: "",
    purchaseInstallmentError: null
  });

  useEffect(() => {
    function onCalculatorApply(event: Event) {
      const detail = (event as CustomEvent).detail as { value?: number } | undefined;
      const value = detail?.value;
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      const normalized = Math.abs(value % 1) > 0.000001 ? Number(value.toFixed(2)) : Math.round(value);
      setState((prev) => ({
        ...prev,
        amount: Number.isFinite(normalized) ? String(normalized) : prev.amount
      }));
    }

    window.addEventListener("mis-finanzas:calculator-apply", onCalculatorApply as EventListener);
    return () => {
      window.removeEventListener("mis-finanzas:calculator-apply", onCalculatorApply as EventListener);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadAccounts() {
      try {
        setAccountsLoading(true);
        const res = await fetch("/api/accounts", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const payload = (await res.json()) as { items?: AccountItem[] };
        const items = (payload.items ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          bank: a.bank ?? null,
          type: a.type
        }));
        if (alive) setAccounts(items);
      } catch {
        if (alive) {
          // Safe fallback for lab mode.
          setAccounts([
            { id: "demo-credit", name: "Credito demo", bank: "Falabella", type: "CREDITO" },
            { id: "demo-cash", name: "Efectivo", bank: null, type: "EFECTIVO" }
          ]);
        }
      } finally {
        if (alive) setAccountsLoading(false);
      }
    }
    void loadAccounts();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadCategories() {
      try {
        setCategoriesLoading(true);
        const res = await fetch("/api/categories", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const payload = (await res.json()) as { items?: CategoryItem[] };
        const items = (payload.items ?? []).map((c) => ({ id: c.id, name: c.name }));
        if (alive) setCategories(items);
      } catch {
        if (alive) {
          setCategories([
            { id: "demo-food", name: "Comida" },
            { id: "demo-transport", name: "Transporte" },
            { id: "demo-home", name: "Hogar" },
            { id: "demo-services", name: "Servicios" },
            { id: "demo-other", name: "Otros" }
          ]);
        }
      } finally {
        if (alive) setCategoriesLoading(false);
      }
    }
    void loadCategories();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (mode !== "real") return;
    let alive = true;

    async function loadParties() {
      try {
        const [debtsRes, unitsRes] = await Promise.all([
          fetch("/api/debts", { cache: "no-store" }),
          fetch("/api/business-units", { cache: "no-store" })
        ]);

        if (debtsRes.ok) {
          const payload = (await debtsRes.json()) as {
            people?: { id: string; name: string; totalAmount: number; notes: string | null }[];
          };
          const items = (payload.people ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            totalAmount: typeof p.totalAmount === "number" ? p.totalAmount : 0,
            notes: p.notes ?? null
          }));
          if (alive && items.length) setPeople(items);
        }

        if (unitsRes.ok) {
          const payload = (await unitsRes.json()) as { items?: { id: string; name: string }[] };
          const items = (payload.items ?? []).map((u) => ({ id: u.id, name: u.name }));
          if (alive && items.length) setCompanies(items);
        }
      } catch {
        // Keep demo defaults as fallback.
      }
    }

    void loadParties();
    return () => {
      alive = false;
    };
  }, [mode]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === state.accountId) ?? null,
    [accounts, state.accountId]
  );

  const filteredPeople = useMemo(() => {
    const q = normalizeKey(personQuery);
    if (!q) return people;
    return people.filter((p) => normalizeKey(p.name).includes(q));
  }, [people, personQuery]);

  const filteredCompanies = useMemo(() => {
    const q = normalizeKey(companyQuery);
    if (!q) return companies;
    return companies.filter((c) => normalizeKey(c.name).includes(q));
  }, [companies, companyQuery]);

  const peopleBuckets = useMemo(() => {
    const byRecent = new Set(recentPersonIds);
    const sorted = [...filteredPeople].sort((a, b) => {
      const ar = byRecent.has(a.id) ? 1 : 0;
      const br = byRecent.has(b.id) ? 1 : 0;
      if (ar !== br) return br - ar;
      return a.name.localeCompare(b.name);
    });

    const frequent = sorted.filter((p, idx) => byRecent.has(p.id) || idx < 3);
    const frequentIds = new Set(frequent.map((p) => p.id));
    const others = sorted.filter((p) => !frequentIds.has(p.id));
    return { frequent, others, frequentIds };
  }, [filteredPeople, recentPersonIds]);

  const companyBuckets = useMemo(() => {
    const byRecent = new Set(recentCompanyIds);
    const sorted = [...filteredCompanies].sort((a, b) => {
      const ar = byRecent.has(a.id) ? 1 : 0;
      const br = byRecent.has(b.id) ? 1 : 0;
      if (ar !== br) return br - ar;
      return a.name.localeCompare(b.name);
    });

    const frequent = sorted.filter((c, idx) => byRecent.has(c.id) || idx < 3);
    const frequentIds = new Set(frequent.map((c) => c.id));
    const others = sorted.filter((c) => !frequentIds.has(c.id));
    return { frequent, others, frequentIds };
  }, [filteredCompanies, recentCompanyIds]);

  const steps = useMemo(
    () =>
      buildDynamicSteps({
        accountType: selectedAccount?.type ?? null,
        movementType: state.movementType,
        creditPayIntent: state.creditPayIntent,
        expenseOwner: state.expenseOwner,
        creditPayWhat: state.creditPayWhat,
        lockedMovementType: Boolean(initialMovementType)
      }),
    [selectedAccount?.type, state.movementType, state.creditPayIntent, state.creditPayWhat, state.expenseOwner, initialMovementType]
  );

  const step = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))];

  useEffect(() => {
    lastStepKeyRef.current = step.key;
  }, [step.key]);

  useEffect(() => {
    // When the step list changes (conditional flow), keep the user on the same logical step if it still exists.
    setStepIndex((prev) => {
      const targetKey = lastStepKeyRef.current;
      const nextIndex = steps.findIndex((s) => s.key === targetKey);
      if (nextIndex >= 0) return nextIndex;
      return Math.min(prev, Math.max(steps.length - 1, 0));
    });
  }, [steps]);

  useEffect(() => {
    // When the "payment of one installment" path is active, suggest who that installment belongs to,
    // based on existing debts/reimbursements generated from credit-card purchases on this same card.
    const accountId = state.accountId;
    const shouldLoad =
      step.key === "creditInstallmentTarget" &&
      Boolean(accountId) &&
      selectedAccount?.type === "CREDITO" &&
      state.movementType === "INGRESO" &&
      state.creditPayIntent === "PAY_CARD" &&
      state.creditPayWhat === "INSTALLMENT";

    if (!shouldLoad) return;

    let alive = true;
    async function loadCandidates() {
      try {
        setCreditInstallmentCandidates((prev) => ({ ...prev, loading: true, error: null }));

        const [txRes, debtsRes] = await Promise.all([
          fetch(`/api/transactions?accountId=${encodeURIComponent(accountId!)}&type=EGRESO&take=500`, {
            cache: "no-store"
          }),
          fetch("/api/debts", { cache: "no-store" })
        ]);

        const txPayload = txRes.ok ? ((await txRes.json()) as any) : null;
        const debtsPayload = debtsRes.ok ? ((await debtsRes.json()) as any) : null;

        const txItems = ((txPayload?.items ?? []) as any[])
          .map((t) => {
            const amount = typeof t?.amount === "number" ? Math.abs(t.amount) : Number.NaN;
            return {
              id: String(t.id),
              description: String(t.description ?? "Movimiento"),
              date: String(t.date ?? ""),
              amount: Number.isFinite(amount) ? amount : 0,
              isInstallmentPurchase: Boolean(t?.isInstallmentPurchase),
              cuotaActual: typeof t?.cuotaActual === "number" ? t.cuotaActual : null,
              cuotaTotal: typeof t?.cuotaTotal === "number" ? t.cuotaTotal : null
            };
          })
          .filter((t) => Boolean(t.id));

        const txIds = new Set<string>((txPayload?.items ?? []).map((t: any) => String(t.id)).filter(Boolean));

        const people = (debtsPayload?.people ?? []) as Array<{ id: string; name: string; notes?: string | null }>;
        const companies = (debtsPayload?.companies ?? []) as Array<{
          id: string;
          name: string;
          entries?: Array<{ transactionId?: string | null }>;
        }>;

        const extractSourceTxId = (notes?: string | null) => {
          if (!notes) return null;
          const match = String(notes).match(/\bauto:source-tx:([a-z0-9_]+)\b/i);
          return match ? match[1] : null;
        };

        const peopleCounts = people
          .map((p) => {
            const sourceTxId = extractSourceTxId(p.notes ?? null);
            const sourceTxIds = sourceTxId && txIds.has(sourceTxId) ? [sourceTxId] : [];
            return {
              id: p.id,
              name: p.name,
              purchasesCount: sourceTxIds.length,
              sourceTxIds
            };
          })
          .filter((p) => p.sourceTxIds.length > 0)
          .sort((a, b) => b.purchasesCount - a.purchasesCount || a.name.localeCompare(b.name));

        const companyCounts = companies
          .map((c) => {
            const entries = c.entries ?? [];
            const sourceTxIds = entries.reduce<string[]>((acc, entry) => {
              const txId = entry?.transactionId ? String(entry.transactionId) : null;
              if (txId && txIds.has(txId) && !acc.includes(txId)) acc.push(txId);
              return acc;
            }, []);
            return { id: c.id, name: c.name, purchasesCount: sourceTxIds.length, sourceTxIds };
          })
          .filter((c) => c.sourceTxIds.length > 0)
          .sort((a, b) => b.purchasesCount - a.purchasesCount || a.name.localeCompare(b.name));

        if (!alive) return;
        setCreditInstallmentCandidates({
          loading: false,
          error: null,
          txItems,
          people: peopleCounts,
          companies: companyCounts
        });
      } catch (e) {
        if (!alive) return;
        setCreditInstallmentCandidates((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e.message : "No se pudieron cargar sugerencias."
        }));
      }
    }

    void loadCandidates();
    return () => {
      alive = false;
    };
  }, [
    step.key,
    state.accountId,
    state.movementType,
    state.creditPayIntent,
    state.creditPayWhat,
    selectedAccount?.type
  ]);

  const progress = useMemo(() => {
    const total = Math.max(steps.length - 1, 1);
    if (step.key === "welcome") return 0;
    return Math.round((Math.min(stepIndex, total) / total) * 100);
  }, [stepIndex, step.key, steps.length]);

  const stepTitle = useMemo(() => {
    if (step.key === "account") {
      if (state.movementType === "INGRESO") return "¿En qué cuenta entra este dinero?";
      if (state.movementType === "TRANSFERENCIA") return "¿Desde qué cuenta estás moviendo dinero?";
      return "¿Desde dónde pagaste este gasto?";
    }
    if (step.key === "amount") {
      if (state.movementType === "INGRESO") {
        if (selectedAccount?.type === "CREDITO") {
          return state.creditPayIntent === "PAY_CARD" ? "¿Cuánto pagaste de la tarjeta?" : "¿Cuánto abonaste a la tarjeta?";
        }
        return "¿Cuánto recibiste?";
      }
      if (state.movementType === "TRANSFERENCIA") return "¿Cuánto estás moviendo?";
      return "¿Cuánto pagaste?";
    }
    if (step.key === "owner") {
      return state.movementType === "GASTO" ? "¿A quién corresponde este gasto?" : STEP_TITLES.owner;
    }
    if (step.key === "category") {
      return state.movementType === "GASTO" ? "¿En qué categoría cae?" : STEP_TITLES.category;
    }
    if (step.key === "note") {
      return state.movementType === "TRANSFERENCIA" ? "¿Quieres dejar un detalle?" : STEP_TITLES.note;
    }
    return STEP_TITLES[step.key];
  }, [selectedAccount?.type, state.creditPayIntent, state.movementType, step.key]);

  const selectedCategory = useMemo(
    () => {
      const found = categories.find((c) => c.id === state.categoryId) ?? null;
      if (!found) return null;
      // Don't treat ownership labels as "category" in the demo flow.
      if (isOwnershipLikeCategoryName(found.name, state.expenseOwner)) return null;
      return found;
    },
    [categories, state.categoryId, state.expenseOwner]
  );

  const amountNumber = useMemo(() => parseAmount(state.amount), [state.amount]);
  const accountContext = useMemo(() => getDemoAccountContext(selectedAccount), [selectedAccount]);

  const isReadyToConfirm = useMemo(() => {
    const required = steps
      .map((s) => s.key)
      .filter((key) => key !== "welcome" && key !== "note" && key !== "review");

    for (const key of required) {
      if (key === "account" && !state.accountId) return false;
      if (key === "amount" && !(amountNumber && amountNumber > 0)) return false;
      if (key === "type" && !state.movementType) return false;
      if (key === "creditExpenseImpact" && !state.creditImpactType) return false;
      if (key === "creditIncomeImpact" && !state.creditImpactType) return false;
      if (key === "creditExpensePayment") {
        if (state.paymentMode === "installments") {
          const total = Number(state.cuotaTotal || 0);
          const current = Number(state.cuotaActual || 0);
          if (!Number.isFinite(total) || total <= 1) return false;
          if (!Number.isFinite(current) || current <= 0) return false;
          if (current > total) return false;
          if (total > 48) return false;
        }
      }
      if (key === "owner" && !state.expenseOwner) return false;
      if (key === "person" && !(state.personName || state.personId)) return false;
      if (key === "company" && !(state.companyName || state.companyId)) return false;
      if (key === "creditPayIntent" && !state.creditPayIntent) return false;
      if (key === "creditPayWhat" && !state.creditPayWhat) return false;
      if (key === "category" && !state.categoryId) return false;
    }
    return true;
  }, [
    amountNumber,
    state.accountId,
    state.categoryId,
    state.companyName,
    state.creditImpactType,
    state.creditPayIntent,
    state.creditPayWhat,
    state.cuotaActual,
    state.cuotaTotal,
    state.expenseOwner,
    state.movementType,
    state.paymentMode,
    state.personName,
    steps
  ]);

  const reviewPrimary = useMemo(() => {
    const hasCategory = steps.some((s) => s.key === "category");
    if (state.movementType === "TRANSFERENCIA") return "Transferencia";

    if (state.movementType === "INGRESO") {
      if (selectedAccount?.type === "CREDITO") {
        return state.creditPayIntent === "PAY_CARD" ? "Pago a tarjeta" : "Abono a tarjeta";
      }
      return "Ingreso a cuenta";
    }

    if (state.movementType === "GASTO") {
      if (state.expenseOwner === "MINE") return "Gasto personal";
      if (state.expenseOwner === "PERSON") return "Gasto de otra persona";
      if (state.expenseOwner === "COMPANY") return "Gasto de empresa";
      if (hasCategory && selectedCategory?.name) return selectedCategory.name;
      return "Gasto";
    }

    if (hasCategory && selectedCategory?.name) return selectedCategory.name;
    return "Movimiento";
  }, [selectedAccount?.type, selectedCategory?.name, state.creditPayIntent, state.movementType, steps]);

  const reviewSecondary = useMemo(() => {
    if (state.movementType === "INGRESO" && selectedAccount?.type === "CREDITO") {
      if (state.creditPayIntent === "PAY_CARD") {
        const what = getCreditPayWhatLabel(state.creditPayWhat);
        if (state.creditPayWhat === "INSTALLMENT" && state.creditInstallmentTargetName) {
          return `Cuota: ${state.creditInstallmentTargetName}`;
        }
        return what ? `Pago: ${what.toLowerCase()}` : "Pago de tarjeta";
      }
      if (state.creditPayIntent === "JUST_CREDIT") return "Abono / ajuste";
    }

    if (state.movementType === "GASTO") {
      const owner = getExpenseOwnerLabel(state.expenseOwner);
      return owner ? `Corresponde: ${owner.toLowerCase()}` : "Gasto";
    }

    return null;
  }, [
    selectedAccount?.type,
    state.creditInstallmentTargetName,
    state.creditPayIntent,
    state.creditPayWhat,
    state.expenseOwner,
    state.movementType
  ]);

  const reviewDetails = useMemo(() => {
    if (state.movementType === "TRANSFERENCIA") {
      return "Mueve dinero entre tus cuentas (no se considera gasto).";
    }
    if (state.movementType === "INGRESO") {
      if (selectedAccount?.type === "CREDITO") {
        if (state.creditPayIntent === "PAY_CARD") {
          const what = getCreditPayWhatLabel(state.creditPayWhat);
          if (state.creditPayWhat === "INSTALLMENT" && state.creditInstallmentTargetName) {
            return `Vas a registrar una cuota asociada a ${state.creditInstallmentTargetName}.`;
          }
          return what ? `Vas a registrar: ${what.toLowerCase()}.` : "Vas a registrar un pago de tarjeta.";
        }
        return "Vas a registrar un abono/ajuste en la tarjeta.";
      }
      return "Vas a registrar dinero que entra a tu cuenta.";
    }
    if (state.movementType === "GASTO") {
      if (selectedAccount?.type === "CREDITO") {
        const impact = getCreditImpactLabel(state.creditImpactType);
        const payMode =
          state.paymentMode === "installments"
            ? (() => {
                const total = Number(state.cuotaTotal || 0);
                const current = Number(state.cuotaActual || 0);
                if (Number.isFinite(total) && total > 1 && Number.isFinite(current) && current > 0) {
                  return `En cuotas: cuota ${current} de ${total}.`;
                }
                return "En cuotas.";
              })()
            : "Pago único.";
        return [impact ? `Impacto: ${impact}.` : null, payMode].filter(Boolean).join(" ");
      }
      if (state.expenseOwner === "PERSON") {
        const who = state.personName ? ` Persona: ${state.personName}.` : "";
        return `Queda como gasto que te deben (demo).${who}`;
      }
      if (state.expenseOwner === "COMPANY") {
        const who = state.companyName ? ` Empresa: ${state.companyName}.` : "";
        return `Queda separado como gasto de empresa (demo).${who}`;
      }
      return "Queda como gasto propio.";
    }
    return null;
  }, [
    selectedAccount?.type,
    state.companyName,
    state.creditImpactType,
    state.creditInstallmentTargetName,
    state.creditPayIntent,
    state.creditPayWhat,
    state.cuotaActual,
    state.cuotaTotal,
    state.expenseOwner,
    state.movementType,
    state.paymentMode,
    state.personName
  ]);

  const visibleCategories = useMemo(() => {
    return categories.filter((c) => !isOwnershipLikeCategoryName(c.name, state.expenseOwner));
  }, [categories, state.expenseOwner]);

  useEffect(() => {
    // If the chosen category becomes invalid/hidden (e.g. "Empresa"), clear it to avoid confusion.
    if (!state.categoryId) return;
    const existsAndVisible = visibleCategories.some((c) => c.id === state.categoryId);
    if (!existsAndVisible) {
      setState((s) => ({ ...s, categoryId: null }));
    }
  }, [state.categoryId, visibleCategories]);

  const suggestedCategories = useMemo(() => {
    if (!visibleCategories.length) return { items: [] as CategoryItem[], orderedIds: new Set<string>() };
    const keys = getSuggestedCategoryKeys(accountContext, state.expenseOwner);
    // Soft match: category name contains any key
    const suggested: CategoryItem[] = [];
    for (const key of keys) {
      const found = visibleCategories.find((c) => normalizeKey(c.name).includes(normalizeKey(key)));
      if (found && !suggested.some((s) => s.id === found.id)) suggested.push(found);
    }
    const orderedIds = new Set(suggested.map((s) => s.id));
    return { items: suggested, orderedIds };
  }, [visibleCategories, accountContext, state.expenseOwner]);

  const orderedCategories = useMemo(() => {
    if (!visibleCategories.length) return [];
    if (!suggestedCategories.items.length) {
      return [...visibleCategories].sort((a, b) => a.name.localeCompare(b.name));
    }
    const rest = visibleCategories.filter((c) => !suggestedCategories.orderedIds.has(c.id));
    return [...suggestedCategories.items, ...rest.sort((a, b) => a.name.localeCompare(b.name))];
  }, [visibleCategories, suggestedCategories]);

  const contextualHint = useMemo(() => {
    const isCredit = selectedAccount?.type === "CREDITO";
    if (state.movementType === "TRANSFERENCIA") {
      return "Vas moviendo dinero entre cuentas, sin mezclarlo con gastos.";
    }
    if (state.movementType === "INGRESO") {
      if (isCredit) return "En tarjetas, un ingreso suele ser un pago o un abono.";
      return "Dinero que entra a tu cuenta.";
    }
    if (state.movementType === "GASTO") {
      if (isCredit) return "En tarjetas, esto consume cupo y luego se paga.";
      return "Esto te ayuda a entender en qué se va tu dinero.";
    }
    return "Vamos paso a paso.";
  }, [selectedAccount?.type, state.movementType]);

  const progressLine = useMemo(() => {
    if (step.key === "welcome") return "Vamos paso a paso";
    if (step.key === "account" || step.key === "amount") return "Vamos paso a paso";
    if (step.key === "type" || step.key === "owner" || step.key === "creditPayIntent") return "Ya casi está";
    if (step.key === "creditPayWhat" || step.key === "category") return "Últimos detalles";
    if (step.key === "note") return "Últimos detalles";
    if (step.key === "review") return "Última revisión";
    return "Vamos paso a paso";
  }, [step.key]);

  useEffect(() => {
    if (saved) return;
    if (step.key !== "amount") return;
    const id = window.setTimeout(() => {
      const el = document.getElementById("lab-amount-input") as HTMLInputElement | null;
      el?.focus();
      el?.select?.();
    }, 50);
    return () => window.clearTimeout(id);
  }, [step.key, saved]);

  function canGoNext() {
    if (step.key === "welcome") return true;
    if (step.key === "account") return Boolean(state.accountId);
    if (step.key === "amount") return Boolean(amountNumber && amountNumber > 0);
    if (step.key === "type") return Boolean(state.movementType);
    if (step.key === "creditExpenseImpact") return Boolean(state.creditImpactType);
    if (step.key === "creditIncomeImpact") return Boolean(state.creditImpactType);
    if (step.key === "creditExpensePayment") {
      if (state.paymentMode !== "installments") return true;
      const total = Number(state.cuotaTotal || 0);
      const current = Number(state.cuotaActual || 0);
      if (!Number.isFinite(total) || total <= 1) return false;
      if (!Number.isFinite(current) || current <= 0) return false;
      if (current > total) return false;
      if (total > 48) return false;
      return true;
    }
    if (step.key === "owner") return Boolean(state.expenseOwner);
    if (step.key === "person") return Boolean(state.personName || state.personId);
    if (step.key === "company") return Boolean(state.companyName || state.companyId);
    if (step.key === "creditPayIntent") return Boolean(state.creditPayIntent);
    if (step.key === "creditPayWhat") return Boolean(state.creditPayWhat);
    if (step.key === "category") return Boolean(state.categoryId);
    return true;
  }

  function next() {
    if (!canGoNext()) return;
    setStepIndex((prev) => Math.min(prev + 1, Math.max(steps.length - 1, 0)));
  }

  function back() {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }

  function goToWelcome() {
    setSaved(false);
    setSaving(false);
    setSaveError(null);
    setStepIndex(0);
  }

  async function saveTransaction() {
    if (saving) return;
    setSaveError(null);
    setSaving(true);

    const today = getTodayISO();
    const isCreditAccount = selectedAccount?.type === "CREDITO";
    const transactionType = state.movementType === "INGRESO" ? "INGRESO" : "EGRESO";
    const absoluteAmount = Math.abs(amountNumber ?? 0);

    const baseDescription =
      state.note.trim() ||
      selectedCategory?.name ||
      (state.movementType === "TRANSFERENCIA"
        ? "Transferencia"
        : state.movementType === "INGRESO"
          ? "Ingreso"
          : "Gasto");

    const description =
      state.expenseOwner === "PERSON" && state.personName
        ? `${baseDescription} · ${state.personName}`
        : state.expenseOwner === "COMPANY" && state.companyName
          ? `${baseDescription} · ${state.companyName}`
          : baseDescription;

    const resolvedCreditImpactType: CreditImpactType | undefined = isCreditAccount
      ? state.movementType === "GASTO"
        ? state.creditImpactType ?? "consume_cupo"
        : state.movementType === "INGRESO"
          ? state.creditPayIntent === "PAY_CARD"
            ? (state.creditImpactType ?? "pago_tarjeta")
            : "ajuste_manual"
          : "ajuste_manual"
      : undefined;

    const hasCategoryStep = steps.some((s) => s.key === "category");
    const categoryId = hasCategoryStep ? state.categoryId : null;

    const isCompany = state.expenseOwner === "COMPANY";
    const isPerson = state.expenseOwner === "PERSON";
    const financialOrigin = isCompany ? "EMPRESA" : "PERSONAL";

    try {
      if (mode === "demo") {
        const payload = {
          mode: "DEMO",
          accountId: state.accountId,
          amount: absoluteAmount,
          movementType: state.movementType,
          type: transactionType,
          description,
          categoryId,
          ownership: state.expenseOwner,
          personId: state.personId ?? null,
          personName: state.personName ?? null,
          companyId: state.companyId ?? null,
          companyName: state.companyName ?? null,
          creditPayIntent: state.creditPayIntent,
          creditPayWhat: state.creditPayWhat,
          note: state.note || null
        };
        // Demo only: do not persist.
        // eslint-disable-next-line no-console
        console.log("[lab:add-expense] simulated save", payload);
        await new Promise((r) => setTimeout(r, 750));
        setSaved(true);
        return;
      }

      let businessUnitId: string | null = null;
      if (isCompany) {
        const isDraft = (state.companyId ?? "").startsWith("draft-company:");
        if (state.companyId && !isDraft && state.companyId.startsWith("demo-company:") === false) {
          businessUnitId = state.companyId;
        } else if (state.companyName?.trim()) {
          // Create business unit on-demand so reimbursements can link to it.
          const createRes = await fetch("/api/business-units", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: state.companyName.trim(), type: "NEGOCIO" })
          });
          const payload = (await createRes.json()) as { item?: { id: string; name: string }; message?: string };
          if (!createRes.ok || !payload.item) {
            throw new Error(payload.message ?? "No se pudo crear la empresa.");
          }
          businessUnitId = payload.item.id;
          setCompanies((prev) =>
            prev.some((c) => c.id === payload.item!.id) ? prev : [{ id: payload.item!.id, name: payload.item!.name }, ...prev]
          );
          setState((s) => ({ ...s, companyId: payload.item!.id, companyName: payload.item!.name }));
        }
      }

      const notesParts = [
        state.movementType === "TRANSFERENCIA" ? "Transferencia manual" : null,
        isCreditAccount && state.movementType === "INGRESO" && state.creditPayIntent === "PAY_CARD"
          ? [
              "Pago tarjeta",
              state.creditPayWhat ? `Pago: ${getCreditPayWhatLabel(state.creditPayWhat)}` : null,
              state.creditPayWhat === "INSTALLMENT" && state.creditInstallmentTargetName
                ? `Cuota de: ${state.creditInstallmentTargetName}`
                : null
            ]
              .filter(Boolean)
              .join(" · ")
          : null,
        isPerson ? "Corresponde: otra persona" : isCompany ? "Corresponde: empresa" : "Corresponde: es mío",
        state.note.trim() || null
      ].filter(Boolean);

      const txRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          description: description.trim().length >= 3 ? description.trim() : "Movimiento",
          amount: Math.max(1, absoluteAmount),
          type: transactionType,
          accountId: state.accountId,
          categoryId,
          financialOrigin,
          businessUnitId: isCompany ? businessUnitId : null,
          isBusinessPaidPersonally: isCompany && transactionType === "EGRESO",
          isReimbursable: (isPerson || isCompany) && transactionType === "EGRESO",
          notes: notesParts.length ? notesParts.join(" · ") : undefined,
          owed:
            (isPerson || isCompany) && transactionType === "EGRESO"
              ? {
                  isOwed: true,
                  byType: isCompany ? "EMPRESA" : "PERSONA",
                  amount: Math.max(1, absoluteAmount),
                  debtorId: null,
                  debtorName: isCompany ? (state.companyName ?? null) : (state.personName ?? null),
                  businessUnitId: isCompany ? businessUnitId : null
                }
              : null,
          ...(isCreditAccount ? { creditImpactType: resolvedCreditImpactType } : {}),
          ...(isCreditAccount && state.movementType === "GASTO"
            ? {
                isInstallmentPurchase: state.paymentMode === "installments",
                cuotaActual:
                  state.paymentMode === "installments" ? Math.max(1, Math.floor(Number(state.cuotaActual || 0))) : null,
                cuotaTotal:
                  state.paymentMode === "installments" ? Math.max(2, Math.floor(Number(state.cuotaTotal || 0))) : null
              }
            : {})
        })
      });
      const txPayload = (await txRes.json()) as any;
      if (!txRes.ok) throw new Error(txPayload?.message ?? "No se pudo guardar el movimiento.");

      const createdTransactionId = (txPayload?.item?.id as string | undefined) ?? undefined;

      if (isPerson && transactionType === "EGRESO") {
        const owedAmount = Math.max(1, absoluteAmount);
        const selected = state.personId ? people.find((p) => p.id === state.personId) : null;
        const isDraft = (state.personId ?? "").startsWith("draft-person:");
        const isDemo = (state.personId ?? "").startsWith("demo-person:");
        const sourceMarker = createdTransactionId ? `auto:source-tx:${createdTransactionId}` : null;

        const isInstallmentDebt =
          selectedAccount?.type === "CREDITO" &&
          state.movementType === "GASTO" &&
          state.paymentMode === "installments";
        const installmentTotal = Math.max(0, Math.floor(Number(state.cuotaTotal || 0)));
        const installmentCurrent = Math.max(0, Math.floor(Number(state.cuotaActual || 0)));
        const canUseInstallments =
          isInstallmentDebt && Number.isFinite(installmentTotal) && installmentTotal > 1;
        const purchaseTotalAmount = canUseInstallments ? Math.max(1, owedAmount * installmentTotal) : owedAmount;

        if (state.personId && !isDraft && !isDemo && selected) {
          const patchRes = await fetch(`/api/debts/${state.personId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              totalAmount: Math.max(1, selected.totalAmount + purchaseTotalAmount),
              status: "PENDIENTE",
              notes:
                [selected.notes, sourceMarker, state.note.trim() || null]
                  .filter(Boolean)
                  .join(" · ") || null
            })
          });
          const patchPayload = (await patchRes.json()) as { message?: string };
          if (!patchRes.ok) {
            throw new Error(patchPayload.message ?? "No se pudo actualizar la deuda de la persona.");
          }
        } else if (state.personName?.trim()) {
          const createRes = await fetch("/api/debts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: state.personName.trim(),
              reason: description.trim() || "Movimiento",
              totalAmount: purchaseTotalAmount,
              startDate: today,
              estimatedPayDate: null,
              isInstallmentDebt: canUseInstallments,
              installmentCount: canUseInstallments ? installmentTotal : 0,
              installmentValue: canUseInstallments ? Math.max(0, owedAmount) : 0,
              paidInstallments: canUseInstallments ? Math.max(0, Math.min(installmentTotal, installmentCurrent - 1)) : 0,
              installmentFrequency: "MENSUAL",
              nextInstallmentDate: null,
              notes: [sourceMarker, state.note.trim() || null].filter(Boolean).join(" · ") || null
            })
          });
          const createPayload = (await createRes.json()) as { message?: string; id?: string };
          if (!createRes.ok) {
            throw new Error(createPayload.message ?? "No se pudo crear la deuda de la persona.");
          }

          // If we created a brand new debtor, swap the draft/demo id so future updates don't duplicate.
          if (createPayload.id) {
            const createdId = createPayload.id;
            setPeople((prev) =>
              prev.some((p) => p.id === createdId)
                ? prev
                : [{ id: createdId, name: state.personName!.trim(), totalAmount: purchaseTotalAmount, notes: null }, ...prev]
            );
            setState((s) => ({
              ...s,
              personId: createdId
            }));
          }
        }
      }

      setSaved(true);
      onSaved?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "No se pudo guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  function restart() {
    setSaved(false);
    setSaving(false);
    setSaveError(null);
    setStepIndex(0);
    setState({
      accountId: null,
      amount: "",
      movementType: initialMovementType ?? "GASTO",
      categoryId: null,
      note: "",
      expenseOwner: null,
      personName: null,
      personId: null,
      companyName: null,
      companyId: null,
      creditPayIntent: null,
      creditPayWhat: null,
      creditInstallmentTargetType: null,
      creditInstallmentTargetId: null,
      creditInstallmentTargetName: null,
      creditImpactType: null,
      paymentMode: "single",
      cuotaActual: "",
      cuotaTotal: "",
      purchaseInstallmentError: null
    });
  }

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-3 sm:space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {mode === "demo" ? "Laboratorio" : "Nuevo movimiento"}
          </p>
          <h2 className="mt-1 truncate text-[1.35rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[1.55rem]">
            {state.movementType === "INGRESO"
              ? "Agregar ingreso"
              : state.movementType === "TRANSFERENCIA"
                ? "Registrar transferencia"
                : "Agregar gasto"}
          </h2>
        </div>
        {mode === "demo" ? (
          <StatPill tone="premium" className="px-3 py-1 text-[10px]">
            DEMO
          </StatPill>
        ) : null}
      </div>

      <SurfaceCard
        variant="soft"
        padding="sm"
        className={cn(
          "border border-white/70 bg-white/65 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur",
          step.key !== "welcome" && "ring-1 ring-white/50"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                {step.key === "welcome" ? "Inicio" : `Paso ${stepIndex}`}
              </StatPill>
              <p className="truncate text-[0.98rem] font-semibold tracking-[-0.02em] text-slate-900">
                {stepTitle}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {step.key === "welcome"
                ? `Te acompaño en ${Math.max(steps.length - 1, 1)} pasos cortos.`
                : `Paso ${stepIndex} de ${Math.max(steps.length - 1, 1)}`}{" "}
              ·{" "}
              {progressLine}
            </p>
          </div>
          <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
            {progress}%
          </StatPill>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </SurfaceCard>

      <SurfaceCard
        key={step.key}
        variant="soft"
        padding="md"
        className={cn(
          // Premium step transition: small fade + subtle slide (provided by animate-fade-up).
          "animate-fade-up will-change-[transform,opacity] border border-white/70 bg-white/70 shadow-[0_22px_52px_rgba(15,23,42,0.08)] backdrop-blur",
          "sm:rounded-[28px]"
        )}
      >
        <div className={cn("transition-[min-height] duration-200 ease-out", !saved && "min-h-[420px] sm:min-h-[380px]")}>
        {saved ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-3xl bg-emerald-100/80 text-emerald-700 ring-1 ring-white/70">
                <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {mode === "demo" ? "Listo. Se ve impecable." : "Movimiento guardado."}
                </p>
                <p className="text-sm text-slate-600">
                  {mode === "demo"
                    ? "Esto es un demo de UX: no se creó ningún movimiento real en tu cuenta."
                    : "Quedó registrado en tus movimientos. Puedes editarlo cuando quieras."}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" className="rounded-full" onClick={restart}>
                {mode === "demo" ? "Crear otro demo" : "Registrar otro"}
              </Button>
              {mode === "demo" ? (
                <Button className="rounded-full" onClick={goToWelcome}>
                  Volver al inicio del demo
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => {
                      onDone?.();
                    }}
                  >
                    Cerrar
                  </Button>
                  <Button
                    className="rounded-full"
                    onClick={() => {
                      window.location.href = "/movimientos";
                      onDone?.();
                    }}
                  >
                    Ver movimientos
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : step.key === "welcome" ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-3xl bg-violet-100/80 text-violet-700 ring-1 ring-white/70">
                <Sparkles className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-[1.05rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.15rem]">
                  Te ayudo a registrar este gasto en menos de 20 segundos
                </p>
                <p className="mt-1 text-sm text-slate-600">Solo lo esencial. Al final revisas antes de confirmar.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatPill tone="neutral" className="px-3 py-1.5 text-[10px]">
                1. Cuenta
              </StatPill>
              <span className="text-xs text-slate-400">→</span>
              <StatPill tone="neutral" className="px-3 py-1.5 text-[10px]">
                2. Monto
              </StatPill>
              <span className="text-xs text-slate-400">→</span>
              <StatPill tone="neutral" className="px-3 py-1.5 text-[10px]">
                3. Categoría
              </StatPill>
              <StatPill tone="premium" className="ml-auto px-3 py-1.5 text-[10px]">
                + resumen
              </StatPill>
            </div>

            <Button className="h-11 w-full rounded-full sm:w-auto sm:self-end" onClick={next} disabled={saving}>
              Comenzar
              <ChevronRight className="ml-1.5 h-4 w-4" strokeWidth={2.2} />
            </Button>
          </div>
        ) : step.key === "account" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Elige la cuenta desde donde salió el movimiento.
            </p>
            {accountsLoading ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <SurfaceCard variant="soft" padding="sm" className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </SurfaceCard>
                <SurfaceCard variant="soft" padding="sm" className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </SurfaceCard>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {accounts.map((account) => {
                  const isSelected = state.accountId === account.id;
                  const Icon = account.type === "CREDITO" ? CreditCard : Wallet2;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => {
                        setState((s) => ({
                          ...s,
                          accountId: account.id,
                          // Reset conditional fields when the base context changes.
                          categoryId: null,
                          expenseOwner: null,
                          creditPayIntent: null,
                          creditPayWhat: null
                        }));
                        // Auto-advance for selection steps.
                        window.setTimeout(() => next(), 90);
                      }}
                      className={cn(
                        "tap-feedback group rounded-[24px] border p-4 text-left shadow-[0_16px_36px_rgba(15,23,42,0.06)] transition",
                        isSelected
                          ? "border-violet-200 bg-gradient-to-br from-violet-50/90 to-white ring-1 ring-violet-200/70 shadow-[0_18px_42px_rgba(124,58,237,0.12)]"
                          : "border-white/70 bg-white/70 hover:bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className={cn(
                              "mt-0.5 flex h-11 w-11 flex-none items-center justify-center rounded-3xl ring-1 ring-white/70 transition",
                              isSelected ? "bg-violet-100/80 text-violet-700" : "bg-slate-100/80 text-slate-600"
                            )}
                          >
                            <Icon className="h-5 w-5" strokeWidth={2.1} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[0.98rem] font-semibold tracking-[-0.02em] text-slate-900">
                              {account.name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {account.bank ? account.bank : "Sin banco"}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                                {account.type === "CREDITO"
                                  ? "Crédito"
                                  : account.type === "DEBITO"
                                    ? "Débito"
                                    : "Efectivo"}
                              </StatPill>
                              {isSelected ? (
                                <StatPill
                                  tone="premium"
                                  className="px-2.5 py-1 text-[10px]"
                                  icon={<Check className="h-3.5 w-3.5" strokeWidth={2.4} />}
                                >
                                  Elegida
                                </StatPill>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {isSelected ? (
                          <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-[0_14px_28px_rgba(124,58,237,0.22)] ring-1 ring-white/50">
                            <Check className="h-4 w-4" strokeWidth={2.8} />
                          </span>
                        ) : (
                          <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-white/60 text-slate-300 ring-1 ring-white/60">
                            <Check className="h-4 w-4" strokeWidth={2.2} />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : step.key === "amount" ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Monto
                </p>
                <p className="text-number-glow mt-1 truncate text-[2.35rem] font-semibold tracking-[-0.05em] text-slate-900 sm:text-[2.75rem]">
                  {amountNumber ? formatCurrency(amountNumber) : "$0"}
                </p>
              </div>
              {selectedAccount ? (
                <StatPill tone="neutral" className="px-3 py-1 text-[10px]">
                  {selectedAccount.name}
                </StatPill>
              ) : null}
            </div>
            <div className="rounded-[24px] border border-white/70 bg-white/75 p-3 shadow-[0_16px_36px_rgba(15,23,42,0.06)] ring-1 ring-white/60">
              <Input
                id="lab-amount-input"
                inputMode="numeric"
                placeholder="Ej: 15990"
                value={state.amount}
                onChange={(e) => setState((s) => ({ ...s, amount: normalizeAmountInput(e.target.value) }))}
                className="h-12 rounded-2xl border-white/60 bg-white/80 text-base shadow-none focus-visible:ring-primary/20"
              />
              <div className="mt-3 flex flex-wrap gap-2">
              {[5000, 10000, 20000, 50000].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="tap-feedback rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)] transition hover:bg-white"
                  onClick={() => setState((s) => ({ ...s, amount: String(value) }))}
                  disabled={saving}
                >
                  {formatCurrency(value)}
                </button>
              ))}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {selectedAccount?.type === "CREDITO"
                ? "Tip: en tarjetas suele ser el monto del movimiento. Puedes ajustarlo en segundos."
                : "Tip: puedes usar un monto rápido y luego ajustarlo si hace falta."}
            </p>
          </div>
	        ) : step.key === "type" ? (
	          <div className="space-y-3">
	            <p className="text-sm text-slate-600">Esto nos ayuda a ordenar mejor tus movimientos</p>
              <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/60 text-slate-600">
                <p className="text-sm">{contextualHint}</p>
              </SurfaceCard>
	            <div className="grid gap-2 sm:grid-cols-3">
              {[
                {
                  key: "GASTO" as const,
                  label: "Gasto",
                  description: "Ocupa tu dinero o cupo disponible",
                  tone: "danger" as const
                },
                {
                  key: "INGRESO" as const,
                  label: "Ingreso",
                  description: "Agrega dinero a tu cuenta",
                  tone: "success" as const
                },
                {
                  key: "TRANSFERENCIA" as const,
                  label: "Transferencia",
                  description: "Mueve dinero entre tus cuentas (no es gasto)",
                  tone: "neutral" as const
                }
              ].map((option) => {
                const selected = state.movementType === option.key;
                const isRecommended = option.key === "GASTO";
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setState((s) => ({
                        ...s,
                        movementType: option.key,
                        // Reset downstream conditional fields when movement type changes.
                        categoryId: null,
                        expenseOwner: null,
                        personName: null,
                        personId: null,
                        companyName: null,
                        companyId: null,
                        creditImpactType: null,
                        paymentMode: "single",
                        cuotaActual: "",
                        cuotaTotal: "",
                        purchaseInstallmentError: null,
                        creditPayIntent: null,
                        creditPayWhat: null
                      }));
                      window.setTimeout(() => next(), 90);
                    }}
                    className={cn(
                      "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
                      selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{option.description}</p>
                      </div>
                      {selected ? (
                        <StatPill tone={option.tone} className="px-2.5 py-1 text-[10px]">
                          {isRecommended ? "Recomendado" : "Elegido"}
                        </StatPill>
                      ) : isRecommended ? (
                        <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                          Recomendado
                        </StatPill>
                      ) : (
                        <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                          {" "}
                        </StatPill>
                      )}
                    </div>
                  </button>
                );
              })}
	            </div>
	          </div>
	        ) : step.key === "creditExpenseImpact" ? (
	          <div className="space-y-3">
	            <p className="text-sm text-slate-600">
	              Define cómo quieres que este gasto afecte el cupo de la tarjeta.
	            </p>
	            <div className="grid gap-2 sm:grid-cols-2">
	              {[
	                { key: "consume_cupo" as const, label: "Compra nueva · consume cupo", description: "Aumenta tu deuda y reduce cupo" },
	                { key: "no_consume_cupo" as const, label: "Ya considerada · solo historial", description: "Solo para registrar el movimiento" }
	              ].map((option) => {
	                const selected = state.creditImpactType === option.key;
	                return (
	                  <button
	                    key={option.key}
	                    type="button"
	                    onClick={() => {
	                      setState((s) => ({ ...s, creditImpactType: option.key }));
	                      window.setTimeout(() => next(), 90);
	                    }}
	                    className={cn(
	                      "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
	                      selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
	                    )}
	                  >
	                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
	                    <p className="mt-1 text-xs text-slate-500">{option.description}</p>
	                  </button>
	                );
	              })}
	            </div>
	          </div>
	        ) : step.key === "creditExpensePayment" ? (
	          <div className="space-y-3">
	            <p className="text-sm text-slate-600">
	              La clasificación es aparte. Aquí solo defines si fue pago único o en cuotas.
	            </p>
	            <div className="grid gap-2 sm:grid-cols-2">
	              {[
	                { key: "single" as const, label: "Pago único", description: "Una sola compra" },
	                { key: "installments" as const, label: "En cuotas", description: "Se paga en varias cuotas" }
	              ].map((option) => {
	                const selected = state.paymentMode === option.key;
	                return (
	                  <button
	                    key={option.key}
	                    type="button"
	                    onClick={() => {
	                      setState((s) => ({
	                        ...s,
	                        paymentMode: option.key,
	                        purchaseInstallmentError: null,
	                        cuotaActual: option.key === "installments" ? s.cuotaActual : "",
	                        cuotaTotal: option.key === "installments" ? s.cuotaTotal : ""
	                      }));
	                      if (option.key === "single") window.setTimeout(() => next(), 90);
	                    }}
	                    className={cn(
	                      "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
	                      selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
	                    )}
	                  >
	                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
	                    <p className="mt-1 text-xs text-slate-500">{option.description}</p>
	                  </button>
	                );
	              })}
	            </div>

	            {state.paymentMode === "installments" ? (
	              <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/65">
	                <div className="grid gap-2 sm:grid-cols-2">
	                  <div>
	                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
	                      Cuota actual
	                    </p>
	                    <Input
	                      inputMode="numeric"
	                      placeholder="Ej: 1"
	                      value={state.cuotaActual}
	                      onChange={(e) =>
	                        setState((s) => ({
	                          ...s,
	                          cuotaActual: normalizeAmountInput(e.target.value),
	                          purchaseInstallmentError: null
	                        }))
	                      }
	                      className="mt-1 h-11 rounded-2xl border-white/60 bg-white/80 text-sm shadow-none focus-visible:ring-primary/20"
	                    />
	                  </div>
	                  <div>
	                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
	                      Total de cuotas
	                    </p>
	                    <Input
	                      inputMode="numeric"
	                      placeholder="Ej: 12"
	                      value={state.cuotaTotal}
	                      onChange={(e) =>
	                        setState((s) => ({
	                          ...s,
	                          cuotaTotal: normalizeAmountInput(e.target.value),
	                          purchaseInstallmentError: null
	                        }))
	                      }
	                      className="mt-1 h-11 rounded-2xl border-white/60 bg-white/80 text-sm shadow-none focus-visible:ring-primary/20"
	                    />
	                  </div>
	                </div>
	                {(() => {
	                  const total = Number(state.cuotaTotal || 0);
	                  const current = Number(state.cuotaActual || 0);
	                  if (Number.isFinite(total) && Number.isFinite(current) && current > total) {
	                    return (
	                      <p className="mt-2 text-xs font-medium text-rose-600">
	                        La cuota actual no puede ser mayor al total.
	                      </p>
	                    );
	                  }
	                  if (Number.isFinite(total) && total > 48) {
	                    return (
	                      <p className="mt-2 text-xs font-medium text-rose-600">
	                        Por seguridad, el total de cuotas no puede ser mayor a 48.
	                      </p>
	                    );
	                  }
	                  if (Number.isFinite(total) && total > 1 && Number.isFinite(current) && current > 0) {
	                    return (
	                      <p className="mt-2 text-xs text-slate-500">
	                        Se verá como: <span className="font-semibold">Cuota {current} de {total}</span>
	                      </p>
	                    );
	                  }
	                  return null;
	                })()}
	              </SurfaceCard>
	            ) : null}
	          </div>
	        ) : step.key === "creditIncomeImpact" ? (
	          <div className="space-y-3">
	            <p className="text-sm text-slate-600">¿Cómo debe impactar este ingreso en tu tarjeta?</p>
	            <div className="grid gap-2 sm:grid-cols-2">
	              {[
	                { key: "pago_tarjeta" as const, label: "Pago de tarjeta · libera cupo", description: "Reduce deuda y aumenta cupo disponible" },
	                { key: "ajuste_manual" as const, label: "Ajuste manual · corrige deuda", description: "Corrección/ajuste especial" }
	              ].map((option) => {
	                const selected = state.creditImpactType === option.key;
	                return (
	                  <button
	                    key={option.key}
	                    type="button"
	                    onClick={() => {
	                      setState((s) => ({ ...s, creditImpactType: option.key }));
	                      window.setTimeout(() => next(), 90);
	                    }}
	                    className={cn(
	                      "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
	                      selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
	                    )}
	                  >
	                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
	                    <p className="mt-1 text-xs text-slate-500">{option.description}</p>
	                  </button>
	                );
	              })}
	            </div>
	          </div>
	        ) : step.key === "owner" ? (
	          <div className="space-y-3">
	            <p className="text-sm text-slate-600">
	              Así lo vas a ver más claro en tus pendientes y reportes.
	            </p>
	            <div className="grid gap-2 sm:grid-cols-3">
	              {[
	                { key: "MINE" as const, label: "Es mío", description: "Lo asumo yo" },
	                { key: "PERSON" as const, label: "Es de otra persona", description: "Me lo devuelven después" },
	                { key: "COMPANY" as const, label: "Es de una empresa", description: "Gasto de negocio/empresa" }
	              ].map((option) => {
	                const selected = state.expenseOwner === option.key;
	                return (
	                  <button
	                    key={option.key}
	                    type="button"
	                    onClick={() => {
	                      setState((s) => ({
	                        ...s,
	                        expenseOwner: option.key,
	                        personName: option.key === "PERSON" ? s.personName : null,
	                        personId: option.key === "PERSON" ? s.personId : null,
	                        companyName: option.key === "COMPANY" ? s.companyName : null,
	                        companyId: option.key === "COMPANY" ? s.companyId : null
	                      }));
	                      window.setTimeout(() => next(), 90);
	                    }}
	                    className={cn(
	                      "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
	                      selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
	                    )}
	                  >
	                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
	                    <p className="mt-1 text-xs text-slate-500">{option.description}</p>
	                  </button>
	                );
	              })}
	            </div>
	          </div>
	        ) : step.key === "person" ? (
	          <div className="space-y-3">
	            <p className="text-sm text-slate-600">
                Elige un deudor frecuente o agrega uno nuevo.
              </p>

              <div className="rounded-[24px] border border-white/70 bg-white/75 p-3 shadow-[0_16px_36px_rgba(15,23,42,0.06)] ring-1 ring-white/60">
                <Input
                  inputMode="text"
                  placeholder="Buscar deudor…"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  className="h-11 rounded-2xl border-white/60 bg-white/80 text-sm shadow-none focus-visible:ring-primary/20"
                />
              </div>

              <div className="space-y-3">
                <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/65">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Deudores frecuentes
                    </p>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {peopleBuckets.frequent.map((person) => {
                      const selected = state.personId === person.id || state.personName === person.name;
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => {
                            setState((s) => ({ ...s, personName: person.name, personId: person.id }));
                            setRecentPersonIds((prev) => [person.id, ...prev.filter((id) => id !== person.id)].slice(0, 8));
                            window.setTimeout(() => next(), 90);
                          }}
                          className={cn(
                            "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
                            selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{person.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{selected ? "Seleccionada" : "Deudor"}</p>
                            </div>
                            <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                              Frecuente
                            </StatPill>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </SurfaceCard>

                {peopleBuckets.others.length ? (
                  <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/65">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Otros contactos
                      </p>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {peopleBuckets.others.map((person) => {
                        const selected = state.personId === person.id || state.personName === person.name;
                        return (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => {
                              setState((s) => ({ ...s, personName: person.name, personId: person.id }));
                              setRecentPersonIds((prev) => [person.id, ...prev.filter((id) => id !== person.id)].slice(0, 8));
                              window.setTimeout(() => next(), 90);
                            }}
                            className={cn(
                              "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
                              selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{person.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{selected ? "Seleccionada" : "Contacto"}</p>
                              </div>
                              <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                                Contacto
                              </StatPill>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </SurfaceCard>
                ) : null}
              </div>

              <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/65">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    + Agregar nuevo deudor
                  </p>
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    inputMode="text"
                    placeholder="Nombre del deudor"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    className="h-11 rounded-2xl border-white/60 bg-white/80 text-sm shadow-none focus-visible:ring-primary/20"
                  />
                  <Button
                    type="button"
                    className="h-11 rounded-full"
                    variant="secondary"
                    disabled={!newPersonName.trim() || saving}
                    onClick={() => {
                      const name = newPersonName.trim();
                      if (!name) return;
                      const id = `draft-person:${normalizeKey(name).replace(/\s+/g, "-")}`;
                      setPeople((prev) =>
                        prev.some((p) => normalizeKey(p.name) === normalizeKey(name))
                          ? prev
                          : [{ id, name, totalAmount: 0, notes: null }, ...prev]
                      );
                      setState((s) => ({ ...s, personName: name, personId: id }));
                      setRecentPersonIds((prev) => [id, ...prev.filter((existing) => existing !== id)].slice(0, 8));
                      setNewPersonName("");
                      window.setTimeout(() => next(), 90);
                    }}
                  >
                    Agregar
                  </Button>
                </div>
              </SurfaceCard>
	          </div>
	        ) : step.key === "company" ? (
	          <div className="space-y-3">
	            <p className="text-sm text-slate-600">
                Elige una empresa frecuente o agrega una nueva.
              </p>

              <div className="rounded-[24px] border border-white/70 bg-white/75 p-3 shadow-[0_16px_36px_rgba(15,23,42,0.06)] ring-1 ring-white/60">
                <Input
                  inputMode="text"
                  placeholder="Buscar empresa…"
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  className="h-11 rounded-2xl border-white/60 bg-white/80 text-sm shadow-none focus-visible:ring-primary/20"
                />
              </div>

              <div className="space-y-3">
                <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/65">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Empresas frecuentes
                    </p>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {companyBuckets.frequent.map((company) => {
                      const selected = state.companyId === company.id || state.companyName === company.name;
                      return (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => {
                            setState((s) => ({ ...s, companyName: company.name, companyId: company.id }));
                            setRecentCompanyIds((prev) => [company.id, ...prev.filter((id) => id !== company.id)].slice(0, 8));
                            window.setTimeout(() => next(), 90);
                          }}
                          className={cn(
                            "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
                            selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{company.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{selected ? "Seleccionada" : "Empresa"}</p>
                            </div>
                            <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                              Frecuente
                            </StatPill>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </SurfaceCard>

                {companyBuckets.others.length ? (
                  <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/65">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Otras empresas
                      </p>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {companyBuckets.others.map((company) => {
                        const selected = state.companyId === company.id || state.companyName === company.name;
                        return (
                          <button
                            key={company.id}
                            type="button"
                            onClick={() => {
                              setState((s) => ({ ...s, companyName: company.name, companyId: company.id }));
                              setRecentCompanyIds((prev) => [company.id, ...prev.filter((id) => id !== company.id)].slice(0, 8));
                              window.setTimeout(() => next(), 90);
                            }}
                            className={cn(
                              "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
                              selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{company.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{selected ? "Seleccionada" : "Empresa"}</p>
                              </div>
                              <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                                Empresa
                              </StatPill>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </SurfaceCard>
                ) : null}
              </div>

              <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/65">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    + Agregar nueva empresa
                  </p>
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    inputMode="text"
                    placeholder="Nombre de la empresa"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="h-11 rounded-2xl border-white/60 bg-white/80 text-sm shadow-none focus-visible:ring-primary/20"
                  />
                  <Button
                    type="button"
                    className="h-11 rounded-full"
                    variant="secondary"
                    disabled={!newCompanyName.trim() || saving}
                    onClick={() => {
                      const name = newCompanyName.trim();
                      if (!name) return;
                      const id = `draft-company:${normalizeKey(name).replace(/\s+/g, "-")}`;
                      setCompanies((prev) =>
                        prev.some((c) => normalizeKey(c.name) === normalizeKey(name))
                          ? prev
                          : [{ id, name }, ...prev]
                      );
                      setState((s) => ({ ...s, companyName: name, companyId: id }));
                      setRecentCompanyIds((prev) => [id, ...prev.filter((existing) => existing !== id)].slice(0, 8));
                      setNewCompanyName("");
                      window.setTimeout(() => next(), 90);
                    }}
                  >
                    Agregar
                  </Button>
                </div>
              </SurfaceCard>
	          </div>
	        ) : step.key === "creditPayIntent" ? (
	          <div className="space-y-3">
	            <p className="text-sm text-slate-600">
	              En tarjetas, un ingreso suele ser un pago o un abono. Elige qué estás haciendo.
	            </p>
	            <div className="grid gap-2 sm:grid-cols-2">
	              {[
	                {
	                  key: "PAY_CARD" as const,
	                  label: "Sí, pagar la tarjeta",
	                  description: "Registrar un pago asociado a tu deuda"
	                },
	                {
	                  key: "JUST_CREDIT" as const,
	                  label: "No, solo registrar abono",
	                  description: "Un abono/ajuste que quieres anotar"
	                }
	              ].map((option) => {
	                const selected = state.creditPayIntent === option.key;
	                return (
	                  <button
	                    key={option.key}
	                    type="button"
	                    onClick={() => {
	                      setState((s) => ({
	                        ...s,
	                        creditPayIntent: option.key,
	                        creditPayWhat: option.key === "PAY_CARD" ? s.creditPayWhat : null,
	                        ...(option.key === "PAY_CARD"
	                          ? {}
	                          : {
	                              creditInstallmentTargetType: null,
	                              creditInstallmentTargetId: null,
	                              creditInstallmentTargetName: null
	                            })
	                      }));
	                      window.setTimeout(() => next(), 90);
	                    }}
	                    className={cn(
	                      "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
	                      selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
	                    )}
	                  >
	                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
	                    <p className="mt-1 text-xs text-slate-500">{option.description}</p>
	                  </button>
	                );
	              })}
	            </div>
	          </div>
	        ) : step.key === "creditPayWhat" ? (
	          <div className="space-y-3">
	            <p className="text-sm text-slate-600">¿Cómo quieres registrar este pago? (demo)</p>
	            <div className="grid gap-2 sm:grid-cols-3">
	              {[
	                { key: "INSTALLMENT" as const, label: "Una cuota", description: "Pagas una cuota específica" },
	                { key: "PARTIAL_DEBT" as const, label: "Parte de la deuda", description: "Un monto parcial" },
	                { key: "TOTAL" as const, label: "Pago total", description: "Dejar en cero el ciclo" }
	              ].map((option) => {
	                const selected = state.creditPayWhat === option.key;
	                return (
	                  <button
	                    key={option.key}
	                    type="button"
	                    onClick={() => {
	                      setState((s) => ({
	                        ...s,
	                        creditPayWhat: option.key,
	                        ...(option.key === "INSTALLMENT"
	                          ? {}
	                          : {
	                              creditInstallmentTargetType: null,
	                              creditInstallmentTargetId: null,
	                              creditInstallmentTargetName: null
	                            })
	                      }));
	                      window.setTimeout(() => next(), 90);
	                    }}
	                    className={cn(
	                      "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
	                      selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
	                    )}
	                  >
	                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
	                    <p className="mt-1 text-xs text-slate-500">{option.description}</p>
	                  </button>
	                );
	              })}
	            </div>
	          </div>
	        ) : step.key === "creditInstallmentTarget" ? (
	          <div className="space-y-3">
	            <p className="text-sm text-slate-600">
	              Te muestro sugerencias basadas en compras en cr&eacute;dito anteriores hechas con esta tarjeta.
	            </p>

	            {creditInstallmentCandidates.loading ? (
	              <div className="grid gap-2 sm:grid-cols-2">
	                {Array.from({ length: 4 }).map((_, idx) => (
	                  <SurfaceCard key={idx} variant="soft" padding="sm" className="space-y-2">
	                    <Skeleton className="h-4 w-32" />
	                    <Skeleton className="h-3 w-24" />
	                  </SurfaceCard>
	                ))}
	              </div>
	            ) : creditInstallmentCandidates.error ? (
	              <SurfaceCard variant="soft" padding="sm" className="border border-rose-200 bg-rose-50/70">
	                <p className="text-sm font-semibold text-rose-700">No se pudieron cargar sugerencias</p>
	                <p className="mt-1 text-xs text-rose-700/80">{creditInstallmentCandidates.error}</p>
	              </SurfaceCard>
	            ) : creditInstallmentCandidates.people.length === 0 &&
	              creditInstallmentCandidates.companies.length === 0 ? (
	              <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/65">
	                <p className="text-sm font-semibold text-slate-900">No encontr&eacute; coincidencias</p>
	                <p className="mt-1 text-xs text-slate-500">
	                  Puedes continuar igual. Si m&aacute;s adelante registras gastos a nombre de personas o
	                  empresas en esta tarjeta, aparecer&aacute;n aqu&iacute;.
	                </p>
	              </SurfaceCard>
	            ) : (
	              <div className="space-y-3">
	                {creditInstallmentCandidates.people.length ? (
	                  <div className="space-y-2">
	                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
	                      Personas
	                    </p>
	                    <div className="grid gap-2 sm:grid-cols-2">
	                      {creditInstallmentCandidates.people.map((person) => {
	                        const selected =
	                          state.creditInstallmentTargetType === "PERSON" &&
	                          state.creditInstallmentTargetId === person.id;
	                        return (
	                          <button
	                            key={person.id}
	                            type="button"
	                            onClick={() => {
	                              setState((s) => ({
	                                ...s,
	                                creditInstallmentTargetType: "PERSON",
	                                creditInstallmentTargetId: person.id,
	                                creditInstallmentTargetName: person.name
	                              }));
	                            }}
	                            className={cn(
	                              "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
	                              selected
	                                ? "border-emerald-200 bg-emerald-50/80"
	                                : "border-white/70 bg-white/70 hover:bg-white"
	                            )}
	                          >
	                            <div className="flex items-center justify-between gap-2">
	                              <p className="truncate text-sm font-semibold text-slate-900">{person.name}</p>
	                              <StatPill tone="neutral" className="px-2 py-1 text-[10px]">
	                                Persona
	                              </StatPill>
	                            </div>
	                            <p className="mt-1 text-xs text-slate-500">
	                              {person.purchasesCount} compra(s) en cr&eacute;dito
	                            </p>
	                          </button>
	                        );
	                      })}
	                    </div>
	                  </div>
	                ) : null}

	                {creditInstallmentCandidates.companies.length ? (
	                  <div className="space-y-2">
	                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
	                      Empresas
	                    </p>
	                    <div className="grid gap-2 sm:grid-cols-2">
	                      {creditInstallmentCandidates.companies.map((company) => {
	                        const selected =
	                          state.creditInstallmentTargetType === "COMPANY" &&
	                          state.creditInstallmentTargetId === company.id;
	                        return (
	                          <button
	                            key={company.id}
	                            type="button"
	                            onClick={() => {
	                              setState((s) => ({
	                                ...s,
	                                creditInstallmentTargetType: "COMPANY",
	                                creditInstallmentTargetId: company.id,
	                                creditInstallmentTargetName: company.name
	                              }));
	                            }}
	                            className={cn(
	                              "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
	                              selected
	                                ? "border-emerald-200 bg-emerald-50/80"
	                                : "border-white/70 bg-white/70 hover:bg-white"
	                            )}
	                          >
	                            <div className="flex items-center justify-between gap-2">
	                              <p className="truncate text-sm font-semibold text-slate-900">{company.name}</p>
	                              <StatPill tone="neutral" className="px-2 py-1 text-[10px]">
	                                Empresa
	                              </StatPill>
	                            </div>
	                            <p className="mt-1 text-xs text-slate-500">
	                              {company.purchasesCount} compra(s) en cr&eacute;dito
	                            </p>
	                          </button>
	                        );
	                      })}
	                    </div>
	                  </div>
	                ) : null}

	                <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/65">
	                  <p className="text-xs text-slate-500">
	                    Opcional: si no seleccionas nada, igual puedes continuar y registrar el pago.
	                  </p>
	                </SurfaceCard>

                  {state.creditInstallmentTargetId && state.creditInstallmentTargetName ? (
                    <SurfaceCard
                      variant="soft"
                      padding="sm"
                      className="border border-emerald-200/70 bg-emerald-50/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700/70">
                            Historial asociado
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                            {state.creditInstallmentTargetName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            Seleccionado como{" "}
                            {getCreditInstallmentTargetTypeLabel(state.creditInstallmentTargetType)?.toLowerCase() ??
                              "referencia"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 rounded-full px-3"
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              creditInstallmentTargetType: null,
                              creditInstallmentTargetId: null,
                              creditInstallmentTargetName: null
                            }))
                          }
                        >
                          Cambiar
                        </Button>
                      </div>

                      {(() => {
                        const id = state.creditInstallmentTargetId;
                        const type = state.creditInstallmentTargetType;
                        const candidate =
                          type === "PERSON"
                            ? creditInstallmentCandidates.people.find((p) => p.id === id) ?? null
                            : type === "COMPANY"
                              ? creditInstallmentCandidates.companies.find((c) => c.id === id) ?? null
                              : null;
                        const sourceTxIds = candidate?.sourceTxIds ?? [];
                        const items = creditInstallmentCandidates.txItems
                          .filter((tx) => sourceTxIds.includes(tx.id))
                          .slice(0, 4);

                        if (!items.length) {
                          return (
                            <p className="mt-3 text-xs text-slate-600">
                              No encontr&eacute; detalles adicionales, pero igual puedes continuar.
                            </p>
                          );
                        }

                        return (
                          <div className="mt-3 space-y-2">
                            {items.map((tx) => {
                              const hasInstallments = Boolean(
                                tx.isInstallmentPurchase && (tx.cuotaTotal ?? 0) > 1
                              );
                              return (
                                <div
                                  key={tx.id}
                                  className="rounded-[18px] border border-white/60 bg-white/70 p-3 shadow-[0_12px_26px_rgba(15,23,42,0.06)]"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-slate-900">
                                        {tx.description}
                                      </p>
                                      <p className="mt-0.5 text-xs text-slate-500">
                                        {formatShortDate(tx.date)}
                                        {hasInstallments && tx.cuotaActual && tx.cuotaTotal
                                          ? ` · Cuota ${tx.cuotaActual} de ${tx.cuotaTotal}`
                                          : ""}
                                      </p>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {formatCurrency(tx.amount)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                className="h-10 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                                onClick={next}
                              >
                                Continuar con esta cuota
                              </Button>
                            </div>
                          </div>
                        );
                      })()}
                    </SurfaceCard>
                  ) : null}
	              </div>
	            )}
	          </div>
	        ) : step.key === "category" ? (
	          <div className="space-y-3">
	            <div className="flex items-start justify-between gap-3">
	              <p className="text-sm text-slate-600">
                {accountContext.segment === "business"
                  ? "Sugerimos categorías típicas de empresa para ordenar tus gastos."
                  : "Sugerimos categorías comunes para llevar mejor tu mes."}
              </p>
              <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                {accountContext.label}
              </StatPill>
            </div>
            {categoriesLoading ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <SurfaceCard key={idx} variant="soft" padding="sm" className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </SurfaceCard>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {suggestedCategories.items.length ? (
                  <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/65">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Sugeridas
                      </p>
                      <p className="text-xs text-slate-500">Basado en {accountContext.label.toLowerCase()}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestedCategories.items.slice(0, 6).map((category) => {
                        const selected = state.categoryId === category.id;
                        return (
                          <button
                            key={category.id}
                            type="button"
                            className={cn(
                              "tap-feedback rounded-full border px-3 py-1.5 text-xs font-semibold shadow-[0_10px_22px_rgba(15,23,42,0.06)] transition",
                              selected
                                ? "border-violet-200 bg-violet-50/90 text-violet-700"
                                : "border-white/70 bg-white/70 text-slate-700 hover:bg-white"
                            )}
                            onClick={() => {
                              setState((s) => ({ ...s, categoryId: category.id }));
                              window.setTimeout(() => next(), 90);
                            }}
                            disabled={saving}
                          >
                            {category.name}
                          </button>
                        );
                      })}
                    </div>
                  </SurfaceCard>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  {orderedCategories.map((category) => {
                    const selected = state.categoryId === category.id;
                    const isSuggested = suggestedCategories.orderedIds.has(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setState((s) => ({ ...s, categoryId: category.id }));
                          window.setTimeout(() => next(), 90);
                        }}
                        className={cn(
                          "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
                          selected
                            ? "border-violet-200 bg-violet-50/80"
                            : isSuggested
                              ? "border-white/70 bg-white/80 hover:bg-white"
                              : "border-white/70 bg-white/70 hover:bg-white"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{category.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {isSuggested ? "Sugerida" : "Categoría"}
                            </p>
                          </div>
                          {isSuggested ? (
                            <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                              Sugerida
                            </StatPill>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : step.key === "note" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Si quieres, deja un detalle para acordarte después.
            </p>
            <textarea
              className={cn(
                "w-full rounded-[22px] border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-900 shadow-[0_14px_32px_rgba(15,23,42,0.06)] outline-none transition",
                "placeholder:text-slate-400 focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
              )}
              rows={5}
              placeholder="Ej: almuerzo con clientes, notaría, etc."
              value={state.note}
              onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Resumen</p>
                <p className="mt-0.5 text-xs text-slate-500">Revisa una última vez antes de confirmar</p>
              </div>
              <StatPill tone="premium" className="px-3 py-1 text-[10px]">
                Demo
              </StatPill>
            </div>

            <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/70">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Todo listo para registrar
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {reviewPrimary}
                  </p>
                  {reviewSecondary ? (
                    <p className="mt-0.5 truncate text-xs text-slate-500">{reviewSecondary}</p>
                  ) : null}
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {selectedAccount?.name ?? "—"}
                  </p>
                  {reviewDetails ? (
                    <p className="mt-2 text-xs text-slate-500">{reviewDetails}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                    {accountContext.label}
                  </StatPill>
                  <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                    {getMovementTypeLabel(state.movementType) ?? "—"}
                  </StatPill>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] bg-white/70 p-3 ring-1 ring-white/60">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Monto</p>
                  <p className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-slate-900">
                    {amountNumber ? formatCurrency(amountNumber) : "$0"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Monto del movimiento</p>
                </div>

                <div className="rounded-[20px] bg-white/70 p-3 ring-1 ring-white/60">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Cuenta</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">{selectedAccount?.name ?? "—"}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {selectedAccount?.bank ? `${selectedAccount.bank} · ` : ""}
                    {selectedAccount?.type === "CREDITO"
                      ? "Crédito"
                      : selectedAccount?.type === "DEBITO"
                        ? "Débito"
                        : selectedAccount
                          ? "Efectivo"
                          : ""}
                  </p>
                </div>

                <div className="rounded-[20px] bg-white/70 p-3 ring-1 ring-white/60 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Nota</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                    {state.note.trim() ? state.note.trim() : "Sin nota"}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">Si todo calza, confirma.</p>
                </div>
              </div>
            </SurfaceCard>

            {mode === "demo" ? (
              <SurfaceCard
                variant="soft"
                padding="sm"
                className="border border-slate-200/80 bg-white/70 text-slate-700"
              >
                <p className="text-sm font-medium">
                  Modo demo: al confirmar solo simulamos el guardado. No se crea un movimiento real.
                </p>
              </SurfaceCard>
            ) : null}
          </div>
        )}

        {!saved && saveError ? (
          <SurfaceCard
            variant="soft"
            padding="sm"
            className="mt-4 border border-rose-200/80 bg-rose-50/70 text-rose-700"
          >
            <p className="text-sm font-medium">{saveError}</p>
          </SurfaceCard>
        ) : null}

        {!saved && step.key !== "welcome" ? (
          <div
            className={cn(
              "mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between",
              // Mobile: keep primary action always visible like a native bottom bar.
              "sticky bottom-0 z-10 -mx-4 px-4 pb-4 pt-3 bg-[linear-gradient(180deg,rgba(248,250,252,0)_0%,rgba(248,250,252,0.88)_38%,rgba(248,250,252,0.94)_100%)] backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0"
            )}
          >
            <Button
              variant="secondary"
              className="h-11 rounded-full"
              onClick={back}
              disabled={stepIndex === 0 || saving}
            >
              <ChevronLeft className="mr-1.5 h-4 w-4" strokeWidth={2.2} />
              Volver
            </Button>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {step.key === "review" ? (
                <Button
                  className="h-12 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_22px_46px_rgba(16,185,129,0.22)] ring-1 ring-white/30 hover:brightness-105 sm:h-11"
                  onClick={saveTransaction}
                  disabled={saving || !isReadyToConfirm}
                >
                  {saving ? "Guardando…" : mode === "demo" ? "Confirmar (demo)" : "Confirmar"}
                  <ChevronRight className="ml-1.5 h-4 w-4" strokeWidth={2.2} />
                </Button>
              ) : (
                <Button className="h-12 rounded-full sm:h-11" onClick={next} disabled={!canGoNext() || saving}>
                  Continuar
                  <ChevronRight className="ml-1.5 h-4 w-4" strokeWidth={2.2} />
                </Button>
              )}
            </div>
          </div>
        ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
