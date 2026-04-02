import { AccountType, FinancialOrigin, TransactionType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { toAmountNumber } from "@/server/lib/amounts";
import { BASE_TRANSACTION_MARKER } from "@/lib/constants/transactions";

const ACCOUNT_META_KEY = "manualAccountMeta";
const CREDIT_CARD_SUMMARY_KEY = "creditCardSummaryByAccountId";

type AccountMeta = {
  color?: string;
  icon?: string;
  appearanceMode?: "auto" | "manual";
  creditLimit?: number;
  closingDay?: number;
  paymentDay?: number;

  // Credit card operational snapshot (kept on the account meta so the account is usable without
  // relying on import batches).
  creditUsed?: number;
  creditAvailable?: number;
  totalBilled?: number;
  minimumDue?: number;
  statementDate?: string; // YYYY-MM-DD
  paymentDate?: string; // YYYY-MM-DD
};

type AccountMetaMap = Record<string, AccountMeta>;

export type CreditCardSummary = {
  cupoTotal: number | null;
  cupoUtilizado: number | null;
  cupoDisponible: number | null;
  montoFacturado: number | null;
  montoMinimo: number | null;
  fechaPago: string | null; // YYYY-MM-DD
  fechaFacturacion: string | null; // YYYY-MM-DD
  updatedAt: string; // ISO
};

type CreditCardSummaryMap = Record<string, CreditCardSummary>;

function readAccountMeta(raw: unknown): AccountMetaMap {
  if (!raw || typeof raw !== "object") return {};
  const map = raw as Record<string, unknown>;
  const parsed: AccountMetaMap = {};

  Object.entries(map).forEach(([accountId, value]) => {
    if (!value || typeof value !== "object") return;
    const candidate = value as Record<string, unknown>;
    const appearanceMode =
      candidate.appearanceMode === "auto"
        ? "auto"
        : candidate.appearanceMode === "manual"
          ? "manual"
          : undefined;
    parsed[accountId] = {
      color: typeof candidate.color === "string" ? candidate.color : undefined,
      icon: typeof candidate.icon === "string" ? candidate.icon : undefined,
      appearanceMode,
      creditLimit:
        typeof candidate.creditLimit === "number" && Number.isFinite(candidate.creditLimit)
          ? candidate.creditLimit
          : undefined,
      closingDay:
        typeof candidate.closingDay === "number" && Number.isFinite(candidate.closingDay)
          ? candidate.closingDay
          : undefined,
      paymentDay:
        typeof candidate.paymentDay === "number" && Number.isFinite(candidate.paymentDay)
          ? candidate.paymentDay
          : undefined,
      creditUsed:
        typeof candidate.creditUsed === "number" && Number.isFinite(candidate.creditUsed)
          ? candidate.creditUsed
          : undefined,
      creditAvailable:
        typeof candidate.creditAvailable === "number" && Number.isFinite(candidate.creditAvailable)
          ? candidate.creditAvailable
          : undefined,
      totalBilled:
        typeof candidate.totalBilled === "number" && Number.isFinite(candidate.totalBilled)
          ? candidate.totalBilled
          : undefined,
      minimumDue:
        typeof candidate.minimumDue === "number" && Number.isFinite(candidate.minimumDue)
          ? candidate.minimumDue
          : undefined,
      statementDate: typeof candidate.statementDate === "string" ? candidate.statementDate : undefined,
      paymentDate: typeof candidate.paymentDate === "string" ? candidate.paymentDate : undefined
    };
  });

  return parsed;
}

function readCreditCardSummaryMap(raw: unknown): CreditCardSummaryMap {
  if (!raw || typeof raw !== "object") return {};
  const map = raw as Record<string, unknown>;
  const parsed: CreditCardSummaryMap = {};

  Object.entries(map).forEach(([accountId, value]) => {
    if (!value || typeof value !== "object") return;
    const candidate = value as Record<string, unknown>;

    const num = (key: string) =>
      typeof candidate[key] === "number" && Number.isFinite(candidate[key]) ? (candidate[key] as number) : null;
    const str = (key: string) => (typeof candidate[key] === "string" ? (candidate[key] as string) : null);

    const updatedAt = str("updatedAt") ?? new Date().toISOString();

    parsed[accountId] = {
      cupoTotal: num("cupoTotal"),
      cupoUtilizado: num("cupoUtilizado"),
      cupoDisponible: num("cupoDisponible"),
      montoFacturado: num("montoFacturado"),
      montoMinimo: num("montoMinimo"),
      fechaPago: str("fechaPago"),
      fechaFacturacion: str("fechaFacturacion"),
      updatedAt
    };
  });

  return parsed;
}

async function getSettingsImportMap(workspaceId: string) {
  const settings = await prisma.appSettings.findUnique({
    where: { workspaceId },
    select: { importSettings: true }
  });
  return settings?.importSettings && typeof settings.importSettings === "object"
    ? (settings.importSettings as Record<string, unknown>)
    : {};
}

async function upsertAccountMeta(workspaceId: string, accountId: string, meta: AccountMeta) {
  const importSettings = await getSettingsImportMap(workspaceId);
  const allMeta = readAccountMeta(importSettings[ACCOUNT_META_KEY]);
  allMeta[accountId] = {
    ...allMeta[accountId],
    ...meta
  };

  await prisma.appSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      dashboardModules: [],
      enabledModules: [],
      suggestedAiQuestions: [],
      transactionLabels: {},
      importSettings: {
        allowedFormats: ["csv", "xlsx", "pdf"],
        ...importSettings,
        [ACCOUNT_META_KEY]: allMeta
      }
    },
    update: {
      importSettings: {
        ...importSettings,
        [ACCOUNT_META_KEY]: allMeta
      }
    }
  });
}

async function getAccountMetaMap(workspaceId: string) {
  const importSettings = await getSettingsImportMap(workspaceId);
  return readAccountMeta(importSettings[ACCOUNT_META_KEY]);
}

export async function upsertCreditCardSummary(input: {
  workspaceId: string;
  accountId: string;
  summary: Omit<CreditCardSummary, "updatedAt"> & { updatedAt?: string };
}) {
  const importSettings = await getSettingsImportMap(input.workspaceId);
  const all = readCreditCardSummaryMap(importSettings[CREDIT_CARD_SUMMARY_KEY]);

  all[input.accountId] = {
    ...all[input.accountId],
    ...input.summary,
    updatedAt: input.summary.updatedAt ?? new Date().toISOString()
  } as CreditCardSummary;

  await prisma.appSettings.upsert({
    where: { workspaceId: input.workspaceId },
    create: {
      workspaceId: input.workspaceId,
      dashboardModules: [],
      enabledModules: [],
      suggestedAiQuestions: [],
      transactionLabels: {},
      importSettings: {
        allowedFormats: ["csv", "xlsx", "pdf"],
        ...importSettings,
        [CREDIT_CARD_SUMMARY_KEY]: all
      }
    },
    update: {
      importSettings: {
        ...importSettings,
        [CREDIT_CARD_SUMMARY_KEY]: all
      }
    }
  });
}

export async function resetWorkspaceCreditCardSnapshots(workspaceId: string) {
  const [importSettings, creditAccounts] = await Promise.all([
    getSettingsImportMap(workspaceId),
    prisma.account.findMany({
      where: { workspaceId, type: AccountType.TARJETA_CREDITO, isActive: true },
      select: { id: true }
    })
  ]);

  const allMeta = readAccountMeta(importSettings[ACCOUNT_META_KEY]);
  const nextMeta: AccountMetaMap = { ...allMeta };

  let accountsTouched = 0;
  let accountsWithSnapshot = 0;

  for (const account of creditAccounts) {
    const current = nextMeta[account.id];
    if (!current) continue;

    const hadSnapshot =
      current.creditUsed !== undefined ||
      current.creditAvailable !== undefined ||
      current.totalBilled !== undefined ||
      current.minimumDue !== undefined ||
      current.statementDate !== undefined ||
      current.paymentDate !== undefined;
    if (hadSnapshot) accountsWithSnapshot += 1;

    // Keep user-defined configuration (creditLimit/closingDay/paymentDay, appearance, etc.).
    const {
      creditUsed,
      creditAvailable,
      totalBilled,
      minimumDue,
      statementDate,
      paymentDate,
      ...rest
    } = current;

    nextMeta[account.id] = rest;
    accountsTouched += 1;
  }

  await prisma.appSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      dashboardModules: [],
      enabledModules: [],
      suggestedAiQuestions: [],
      transactionLabels: {},
      importSettings: {
        allowedFormats: ["csv", "xlsx", "pdf"],
        ...importSettings,
        [ACCOUNT_META_KEY]: nextMeta,
        [CREDIT_CARD_SUMMARY_KEY]: {}
      }
    },
    update: {
      importSettings: {
        ...importSettings,
        [ACCOUNT_META_KEY]: nextMeta,
        [CREDIT_CARD_SUMMARY_KEY]: {}
      }
    }
  });

  return {
    creditAccounts: creditAccounts.length,
    accountsTouched,
    accountsWithSnapshot
  };
}

function normalizeAccountType(type: "CREDITO" | "DEBITO" | "EFECTIVO") {
  if (type === "CREDITO") return AccountType.TARJETA_CREDITO;
  if (type === "DEBITO") return AccountType.TARJETA_DEBITO;
  return AccountType.EFECTIVO;
}

function getTodayAtNoon() {
  const now = new Date();
  return new Date(`${now.toISOString().slice(0, 10)}T12:00:00`);
}

export async function ensureCashWalletAccount(workspaceId: string) {
  const existingCash = await prisma.account.findFirst({
    where: {
      workspaceId,
      isActive: true,
      OR: [
        { type: AccountType.EFECTIVO },
        { name: { equals: "Billetera / Efectivo", mode: "insensitive" } }
      ]
    }
  });
  if (existingCash) return existingCash;

  return prisma.account.create({
    data: {
      workspaceId,
      name: "Billetera / Efectivo",
      institution: "Manual",
      type: AccountType.EFECTIVO,
      currencyCode: "CLP",
      isBusiness: false
    }
  });
}

export async function listManualAccountsWithBalances(workspaceId: string) {
  await ensureCashWalletAccount(workspaceId);

  const [accounts, sums, metaMap] = await Promise.all([
    prisma.account.findMany({
      where: { workspaceId, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { workspaceId, accountId: { not: null } },
      _sum: { amount: true }
    }),
    getAccountMetaMap(workspaceId)
  ]);

  const noConsumeSums = await (async () => {
    try {
      return await prisma.transaction.groupBy({
        by: ["accountId"],
        where: {
          workspaceId,
          accountId: { not: null },
          creditImpactType: "no_consume_cupo"
        },
        _sum: { amount: true }
      });
    } catch (error) {
      console.error("manual accounts no-consume groupBy failed", { workspaceId, error });
      return [];
    }
  })();

  const byAccountId = new Map(
    sums
      .filter((row) => row.accountId)
      .map((row) => [row.accountId as string, toAmountNumber(row._sum.amount ?? 0)])
  );

  const noConsumeByAccountId = new Map(
    noConsumeSums
      .filter((row) => row.accountId)
      .map((row) => [row.accountId as string, toAmountNumber(row._sum.amount ?? 0)])
  );

  return accounts.map((account) => {
    const rawBalance = byAccountId.get(account.id) ?? 0;
    const excludedBalance = account.type === AccountType.TARJETA_CREDITO ? noConsumeByAccountId.get(account.id) ?? 0 : 0;
    const creditBalance = account.type === AccountType.TARJETA_CREDITO ? rawBalance - excludedBalance : rawBalance;
    return {
      id: account.id,
      name: account.name,
      bank: account.institution ?? "Manual",
      type:
        account.type === AccountType.TARJETA_CREDITO
          ? "CREDITO"
          : account.type === AccountType.TARJETA_DEBITO
            ? "DEBITO"
            : "EFECTIVO",
      balance: rawBalance,
      creditBalance,
      color: metaMap[account.id]?.color ?? null,
      icon: metaMap[account.id]?.icon ?? null,
      appearanceMode: metaMap[account.id]?.appearanceMode ?? "manual",
      creditLimit: metaMap[account.id]?.creditLimit ?? null,
      closingDay: metaMap[account.id]?.closingDay ?? null,
      paymentDay: metaMap[account.id]?.paymentDay ?? null,

      // Credit card operational snapshot (if available). These DO NOT represent "cash balance".
      creditUsed: metaMap[account.id]?.creditUsed ?? null,
      creditAvailable: metaMap[account.id]?.creditAvailable ?? null,
      totalBilled: metaMap[account.id]?.totalBilled ?? null,
      minimumDue: metaMap[account.id]?.minimumDue ?? null,
      statementDate: metaMap[account.id]?.statementDate ?? null,
      paymentDate: metaMap[account.id]?.paymentDate ?? null
    };
  });
}

export async function createManualAccount(input: {
  workspaceId: string;
  name: string;
  bank?: string | null;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
  openingBalance?: number;
  color?: string;
  icon?: string;
  appearanceMode?: "auto" | "manual";
  creditLimit?: number;
  closingDay?: number;
  paymentDay?: number;
  creditUsed?: number;
  creditAvailable?: number;
  totalBilled?: number;
  minimumDue?: number;
  statementDate?: string;
  paymentDate?: string;
}) {
  const created = await prisma.account.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      institution: input.bank?.trim() || "Manual",
      type: normalizeAccountType(input.type),
      currencyCode: "CLP",
      isBusiness: false
    }
  });

  if (typeof input.openingBalance === "number" && Number.isFinite(input.openingBalance) && input.openingBalance !== 0) {
    const type = input.openingBalance >= 0 ? TransactionType.INGRESO : TransactionType.EGRESO;
    const signedAmount = input.openingBalance >= 0 ? Math.abs(input.openingBalance) : -Math.abs(input.openingBalance);
    await prisma.transaction.create({
      data: {
        workspaceId: input.workspaceId,
        date: getTodayAtNoon(),
        description: "Saldo inicial de cuenta manual",
        amount: signedAmount,
        type,
        accountId: created.id,
        financialOrigin: FinancialOrigin.PERSONAL,
        reviewStatus: "REVISADO"
      }
    });
  }

  const metaPatch: AccountMeta = {};
  if (input.color) metaPatch.color = input.color;
  if (input.icon) metaPatch.icon = input.icon;
  if (input.appearanceMode) metaPatch.appearanceMode = input.appearanceMode;
  if (typeof input.creditLimit === "number" && Number.isFinite(input.creditLimit) && input.creditLimit > 0) {
    metaPatch.creditLimit = input.creditLimit;
  }
  if (typeof input.closingDay === "number" && Number.isFinite(input.closingDay) && input.closingDay >= 1) {
    metaPatch.closingDay = input.closingDay;
  }
  if (typeof input.paymentDay === "number" && Number.isFinite(input.paymentDay) && input.paymentDay >= 1) {
    metaPatch.paymentDay = input.paymentDay;
  }
  if (typeof input.creditUsed === "number" && Number.isFinite(input.creditUsed) && input.creditUsed >= 0) {
    metaPatch.creditUsed = input.creditUsed;
  }
  if (typeof input.creditAvailable === "number" && Number.isFinite(input.creditAvailable) && input.creditAvailable >= 0) {
    metaPatch.creditAvailable = input.creditAvailable;
  }
  if (typeof input.totalBilled === "number" && Number.isFinite(input.totalBilled) && input.totalBilled >= 0) {
    metaPatch.totalBilled = input.totalBilled;
  }
  if (typeof input.minimumDue === "number" && Number.isFinite(input.minimumDue) && input.minimumDue >= 0) {
    metaPatch.minimumDue = input.minimumDue;
  }
  if (typeof input.statementDate === "string" && input.statementDate.trim()) {
    metaPatch.statementDate = input.statementDate.trim();
  }
  if (typeof input.paymentDate === "string" && input.paymentDate.trim()) {
    metaPatch.paymentDate = input.paymentDate.trim();
  }
  if (Object.keys(metaPatch).length) {
    await upsertAccountMeta(input.workspaceId, created.id, metaPatch);
  }

  return created;
}

export async function updateManualAccount(input: {
  workspaceId: string;
  accountId: string;
  name?: string;
  bank?: string | null;
  type?: "CREDITO" | "DEBITO" | "EFECTIVO";
  isActive?: boolean;
  color?: string;
  icon?: string;
  appearanceMode?: "auto" | "manual";
  creditLimit?: number;
  closingDay?: number;
  paymentDay?: number;
  creditUsed?: number | null;
  creditAvailable?: number | null;
  totalBilled?: number | null;
  minimumDue?: number | null;
  statementDate?: string | null;
  paymentDate?: string | null;
}) {
  const account = await prisma.account.findFirst({
    where: { id: input.accountId, workspaceId: input.workspaceId }
  });
  if (!account) return null;

  await prisma.account.update({
    where: { id: account.id },
    data: {
      name: input.name?.trim() || undefined,
      institution: input.bank === undefined ? undefined : input.bank?.trim() || "Manual",
      type: input.type ? normalizeAccountType(input.type) : undefined,
      isActive: input.isActive
    }
  });

  const metaPatch: AccountMeta = {};
  if (input.color !== undefined) metaPatch.color = input.color;
  if (input.icon !== undefined) metaPatch.icon = input.icon;
  if (input.appearanceMode !== undefined) metaPatch.appearanceMode = input.appearanceMode;
  if (input.creditLimit !== undefined) metaPatch.creditLimit = input.creditLimit;
  if (input.closingDay !== undefined) metaPatch.closingDay = input.closingDay;
  if (input.paymentDay !== undefined) metaPatch.paymentDay = input.paymentDay;
  if (input.creditUsed !== undefined) metaPatch.creditUsed = input.creditUsed ?? undefined;
  if (input.creditAvailable !== undefined) metaPatch.creditAvailable = input.creditAvailable ?? undefined;
  if (input.totalBilled !== undefined) metaPatch.totalBilled = input.totalBilled ?? undefined;
  if (input.minimumDue !== undefined) metaPatch.minimumDue = input.minimumDue ?? undefined;
  if (input.statementDate !== undefined) metaPatch.statementDate = input.statementDate ?? undefined;
  if (input.paymentDate !== undefined) metaPatch.paymentDate = input.paymentDate ?? undefined;
  if (Object.keys(metaPatch).length) {
    await upsertAccountMeta(input.workspaceId, account.id, metaPatch);
  }

  return prisma.account.findUnique({ where: { id: account.id } });
}

export async function resetAccountBaseTransaction(params: {
  workspaceId: string;
  accountId: string;
  desiredBalance: number;
}) {
  const { workspaceId, accountId, desiredBalance } = params;
  await prisma.transaction.deleteMany({
    where: {
      workspaceId,
      accountId,
      description: BASE_TRANSACTION_MARKER
    }
  });

  const aggregate = await prisma.transaction.aggregate({
    where: {
      workspaceId,
      accountId,
      description: { not: BASE_TRANSACTION_MARKER }
    },
    _sum: { amount: true }
  });

  const net = toAmountNumber(aggregate._sum.amount ?? 0);
  const delta = desiredBalance - net;
  if (Math.abs(delta) < 0.01) return null;

  const transactionType = delta >= 0 ? TransactionType.INGRESO : TransactionType.EGRESO;
  return prisma.transaction.create({
    data: {
      workspaceId,
      accountId,
      amount: delta,
      type: transactionType,
      date: new Date(),
      description: BASE_TRANSACTION_MARKER,
      financialOrigin: FinancialOrigin.PERSONAL,
      reviewStatus: "REVISADO"
    }
  });
}
