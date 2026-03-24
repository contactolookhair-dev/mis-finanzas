import { AccountType, FinancialOrigin, TransactionType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { toAmountNumber } from "@/server/lib/amounts";

const ACCOUNT_META_KEY = "manualAccountMeta";

type AccountMeta = {
  color?: string;
  icon?: string;
};

type AccountMetaMap = Record<string, AccountMeta>;

function readAccountMeta(raw: unknown): AccountMetaMap {
  if (!raw || typeof raw !== "object") return {};
  const map = raw as Record<string, unknown>;
  const parsed: AccountMetaMap = {};

  Object.entries(map).forEach(([accountId, value]) => {
    if (!value || typeof value !== "object") return;
    const candidate = value as Record<string, unknown>;
    parsed[accountId] = {
      color: typeof candidate.color === "string" ? candidate.color : undefined,
      icon: typeof candidate.icon === "string" ? candidate.icon : undefined
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

  const byAccountId = new Map(
    sums
      .filter((row) => row.accountId)
      .map((row) => [row.accountId as string, toAmountNumber(row._sum.amount ?? 0)])
  );

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    bank: account.institution ?? "Manual",
    type:
      account.type === AccountType.TARJETA_CREDITO
        ? "CREDITO"
        : account.type === AccountType.TARJETA_DEBITO
          ? "DEBITO"
          : "EFECTIVO",
    balance: byAccountId.get(account.id) ?? 0,
    color: metaMap[account.id]?.color ?? null,
    icon: metaMap[account.id]?.icon ?? null
  }));
}

export async function createManualAccount(input: {
  workspaceId: string;
  name: string;
  bank?: string | null;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
  openingBalance?: number;
  color?: string;
  icon?: string;
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

  if (input.color || input.icon) {
    await upsertAccountMeta(input.workspaceId, created.id, {
      color: input.color,
      icon: input.icon
    });
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

  if (input.color !== undefined || input.icon !== undefined) {
    await upsertAccountMeta(input.workspaceId, account.id, {
      color: input.color,
      icon: input.icon
    });
  }

  return prisma.account.findUnique({ where: { id: account.id } });
}
