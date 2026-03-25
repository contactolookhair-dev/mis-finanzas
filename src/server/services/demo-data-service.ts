"use server";

import { prisma } from "@/server/db/prisma";

type DemoEntityType = "Account" | "Transaction" | "Category" | "Debtor" | "DebtorPayment";

type DemoEntityPayload = {
  workspaceId: string;
  entityType: DemoEntityType;
  entityId: string;
};

type CategorySpec = {
  name: string;
  slug: string;
  type: "INGRESO" | "EGRESO";
};

const demoCategories: CategorySpec[] = [
  { name: "Sueldo mensual", slug: "demo-sueldo", type: "INGRESO" },
  { name: "Bonos y comisiones", slug: "demo-bonos", type: "INGRESO" },
  { name: "Gastos hormiga", slug: "demo-hormiga", type: "EGRESO" },
  { name: "Suscripciones", slug: "demo-suscripciones", type: "EGRESO" },
  { name: "Transporte", slug: "demo-transporte", type: "EGRESO" },
  { name: "Varios", slug: "demo-varios", type: "EGRESO" }
];

const accountSpecs = [
  {
    name: "Cuenta corriente demo",
    institution: "Banco Demo",
    type: "CUENTA_CORRIENTE",
    balance: 850_000
  },
  {
    name: "Cuenta vista demo",
    institution: "Banco Vista",
    type: "CUENTA_VISTA",
    balance: 420_000
  },
  {
    name: "Tarjeta crédito demo",
    institution: "Tarjeta CMR Demo",
    type: "TARJETA_CREDITO",
    balance: 120_000
  },
  {
    name: "Billetera / efectivo demo",
    institution: "Efectivo",
    type: "EFECTIVO",
    balance: 62_000
  }
] as const;

type SeedSummary = {
  accounts: number;
  transactions: number;
  debts: number;
  debtPayments: number;
  categories: number;
};

function buildDate(dayOfMonth: number) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  date.setHours(9, 0, 0, 0);
  return date;
}

export async function seedDemoData(workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    const personalUnit = await tx.businessUnit.upsert({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug: "personal"
        }
      },
      create: {
        workspaceId,
        name: "Personal",
        slug: "personal",
        type: "PERSONAL",
        isActive: true
      },
      update: {
        name: "Personal",
        type: "PERSONAL",
        isActive: true
      }
    });

    const demoEntities: DemoEntityPayload[] = [];

    const categoryMap: Record<string, string> = {};
    for (const category of demoCategories) {
      const result = await tx.category.upsert({
        where: {
          workspaceId_slug: {
            workspaceId,
            slug: category.slug
          }
        },
        create: {
          workspaceId,
          name: category.name,
          slug: category.slug,
          type: category.type
        },
        update: {
          name: category.name,
          type: category.type
        }
      });
      categoryMap[category.slug] = result.id;
      demoEntities.push({
        workspaceId,
        entityType: "Category",
        entityId: result.id
      });
    }

    const accounts = [];
    for (const spec of accountSpecs) {
      const account = await tx.account.create({
        data: {
          workspaceId,
          name: spec.name,
          institution: spec.institution,
          type: spec.type,
          currencyCode: "CLP",
          isActive: true,
          isBusiness: false,
          businessUnitId: personalUnit.id,
          updatedAt: new Date(),
          createdAt: new Date()
        }
      });
      accounts.push(account);
      demoEntities.push({
        workspaceId,
        entityType: "Account",
        entityId: account.id
      });
    }

    const transactionsSpecs = [
      {
        description: "Sueldo bruto mensual",
        amount: 1_250_000,
        type: "INGRESO" as const,
        categorySlug: "demo-sueldo",
        accountIndex: 0,
        day: 1
      },
      {
        description: "Bonos del mes",
        amount: 180_000,
        type: "INGRESO" as const,
        categorySlug: "demo-bonos",
        accountIndex: 0,
        day: 5
      },
      {
        description: "Arriendo y mantenimiento",
        amount: -450_000,
        type: "EGRESO" as const,
        categorySlug: "demo-varios",
        accountIndex: 0,
        day: 6
      },
      {
        description: "Transporte ciudad",
        amount: -48_000,
        type: "EGRESO" as const,
        categorySlug: "demo-transporte",
        accountIndex: 1,
        day: 8
      },
      {
        description: "Suscripción streaming",
        amount: -12_000,
        type: "EGRESO" as const,
        categorySlug: "demo-suscripciones",
        accountIndex: 1,
        day: 10
      },
      {
        description: "Compra periodicidad (gasto hormiga)",
        amount: -4_200,
        type: "EGRESO" as const,
        categorySlug: "demo-hormiga",
        accountIndex: 3,
        day: 12
      }
    ];

    const transactionRecords = [...transactionsSpecs];
    for (let index = 1; index <= 4; index += 1) {
      transactionRecords.push({
        description: `Gasto hormiga #${index}`,
        amount: -2_100,
        type: "EGRESO" as const,
        categorySlug: "demo-hormiga",
        accountIndex: 3,
        day: 12 + index
      });
    }

    let transactionCount = 0;
    for (const spec of transactionRecords) {
      const transaction = await tx.transaction.create({
        data: {
          workspaceId,
          date: buildDate(spec.day),
          description: spec.description,
          amount: spec.amount,
          type: spec.type,
          accountId: accounts[spec.accountIndex]?.id,
          categoryId: categoryMap[spec.categorySlug],
          financialOrigin: "PERSONAL",
          notes: "Datos de demostración",
          businessUnitId: personalUnit.id,
          reviewStatus: "REVISADO"
        }
      });
      transactionCount += 1;
      demoEntities.push({
        workspaceId,
        entityType: "Transaction",
        entityId: transaction.id
      });
    }

    const debtors = [
      {
        name: "Proveedor de insumos creativo",
        reason: "Compra de stock y cuotas",
        totalAmount: 420_000,
        paidAmount: 105_000,
        status: "ATRASADO" as const,
        isInstallmentDebt: true,
        installmentCount: 6,
        installmentValue: 70_000,
        paidInstallments: 1,
        nextInstallmentDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
        estimatedPayDate: new Date(new Date().setMonth(new Date().getMonth() + 2)),
        startDate: buildDate(2),
        installmentFrequency: "MENSUAL" as const
      },
      {
        name: "Cliente creativo",
        reason: "Venta mensual colaborativa",
        totalAmount: 320_000,
        paidAmount: 160_000,
        status: "PENDIENTE" as const,
        isInstallmentDebt: true,
        installmentCount: 4,
        installmentValue: 80_000,
        paidInstallments: 2,
        nextInstallmentDate: new Date(new Date().setDate(new Date().getDate() + 6)),
        estimatedPayDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        startDate: buildDate(3),
        installmentFrequency: "MENSUAL" as const
      }
    ];

    let debtCount = 0;
    let paymentCount = 0;
    for (const debtor of debtors) {
      const createdDebtor = await tx.debtor.create({
        data: {
          workspaceId,
          name: debtor.name,
          reason: debtor.reason,
          totalAmount: debtor.totalAmount,
          paidAmount: debtor.paidAmount,
          status: debtor.status,
          isInstallmentDebt: debtor.isInstallmentDebt,
          installmentCount: debtor.installmentCount,
          installmentValue: debtor.installmentValue,
          paidInstallments: debtor.paidInstallments,
          installmentFrequency: debtor.installmentFrequency,
          nextInstallmentDate: debtor.nextInstallmentDate,
          estimatedPayDate: debtor.estimatedPayDate,
          startDate: debtor.startDate
        }
      });
      debtCount += 1;
      demoEntities.push({
        workspaceId,
        entityType: "Debtor",
        entityId: createdDebtor.id
      });

      const partialPayment = await tx.debtorPayment.create({
        data: {
          debtorId: createdDebtor.id,
          amount: debtor.installmentValue,
          paidAt: new Date(),
          notes: "Pago parcial demo"
        }
      });
      paymentCount += 1;
      demoEntities.push({
        workspaceId,
        entityType: "DebtorPayment",
        entityId: partialPayment.id
      });
    }

    if (demoEntities.length > 0) {
      const normalized = demoEntities.map((entry) => ({
        workspaceId: entry.workspaceId || workspaceId,
        entityType: entry.entityType,
        entityId: entry.entityId
      }));
      await tx.demoEntity.createMany({
        data: normalized,
        skipDuplicates: true
      });
    }

    return {
      accounts: accounts.length,
      transactions: transactionCount,
      debts: debtCount,
      debtPayments: paymentCount,
      categories: demoCategories.length
    } satisfies SeedSummary;
  });
}

type ClearResult = {
  deletedEntities: number;
};

export async function clearDemoData(workspaceId: string) {
  const entries = await prisma.demoEntity.findMany({
    where: { workspaceId }
  });

  if (entries.length === 0) {
    return { deletedEntities: 0 } satisfies ClearResult;
  }

  const grouped = entries.reduce<Record<DemoEntityType, string[]>>(
    (acc, entry) => {
      const entityType = entry.entityType as DemoEntityType;
      acc[entityType].push(entry.entityId);
      return acc;
    },
    {
      Account: [],
      Transaction: [],
      Category: [],
      Debtor: [],
      DebtorPayment: []
    }
  );

  await prisma.$transaction(async (tx) => {
    if (grouped.DebtorPayment.length > 0) {
      await tx.debtorPayment.deleteMany({ where: { id: { in: grouped.DebtorPayment } } });
    }
    if (grouped.Debtor.length > 0) {
      await tx.debtor.deleteMany({ where: { id: { in: grouped.Debtor } } });
    }
    if (grouped.Transaction.length > 0) {
      await tx.transaction.deleteMany({ where: { id: { in: grouped.Transaction } } });
    }
    if (grouped.Account.length > 0) {
      await tx.account.deleteMany({ where: { id: { in: grouped.Account } } });
    }
    if (grouped.Category.length > 0) {
      await tx.category.deleteMany({ where: { id: { in: grouped.Category } } });
    }
    await tx.demoEntity.deleteMany({ where: { workspaceId } });
  });

  return { deletedEntities: entries.length } satisfies ClearResult;
}

export async function resetDemoData(workspaceId: string) {
  await clearDemoData(workspaceId);
  return seedDemoData(workspaceId);
}
