import {
  AccountType,
  BusinessUnitType,
  CategoryType,
  FinancialOrigin,
  PrismaClient,
  ReviewStatus,
  TransactionType
} from "@prisma/client";

const prisma = new PrismaClient();

function makeFingerprint(input: {
  date: string;
  amount: number;
  description: string;
  accountName: string;
}) {
  return [input.date, input.amount, input.description.trim().toLowerCase(), input.accountName]
    .join("|")
    .replace(/\s+/g, " ");
}

async function main() {
  await prisma.reimbursement.deleteMany();
  await prisma.variableExpense.deleteMany();
  await prisma.fixedExpense.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.classificationRule.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.businessUnit.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspaceModule.deleteMany();
  await prisma.workspace.deleteMany();

  const workspace = await prisma.workspace.create({
    data: {
      name: "Workspace Demo Chile",
      slug: "demo-chile",
      description: "Workspace base para finanzas personales y negocios."
    }
  });

  const personal = await prisma.businessUnit.create({
    data: {
      workspaceId: workspace.id,
      name: "Personal",
      slug: "personal",
      type: BusinessUnitType.PERSONAL,
      color: "#6b7280"
    }
  });

  const lookHair = await prisma.businessUnit.create({
    data: {
      workspaceId: workspace.id,
      name: "Look Hair",
      slug: "look-hair",
      type: BusinessUnitType.NEGOCIO,
      color: "#0f766e"
    }
  });

  const houseOfHair = await prisma.businessUnit.create({
    data: {
      workspaceId: workspace.id,
      name: "House of Hair",
      slug: "house-of-hair",
      type: BusinessUnitType.NEGOCIO,
      color: "#0891b2"
    }
  });

  const detallesChile = await prisma.businessUnit.create({
    data: {
      workspaceId: workspace.id,
      name: "Detalles Chile",
      slug: "detalles-chile",
      type: BusinessUnitType.NEGOCIO,
      color: "#be185d"
    }
  });

  const categories = await Promise.all([
    prisma.category.create({
      data: {
        workspaceId: workspace.id,
        name: "Ventas",
        slug: "ventas",
        type: CategoryType.INGRESO,
        sortOrder: 1
      }
    }),
    prisma.category.create({
      data: {
        workspaceId: workspace.id,
        name: "Publicidad digital",
        slug: "publicidad-digital",
        type: CategoryType.EGRESO,
        sortOrder: 2
      }
    }),
    prisma.category.create({
      data: {
        workspaceId: workspace.id,
        name: "Arriendo local",
        slug: "arriendo-local",
        type: CategoryType.EGRESO,
        sortOrder: 3
      }
    }),
    prisma.category.create({
      data: {
        workspaceId: workspace.id,
        name: "Insumos belleza",
        slug: "insumos-belleza",
        type: CategoryType.EGRESO,
        sortOrder: 4
      }
    }),
    prisma.category.create({
      data: {
        workspaceId: workspace.id,
        name: "Transporte",
        slug: "transporte",
        type: CategoryType.EGRESO,
        sortOrder: 5
      }
    })
  ]);

  const categoryBySlug = Object.fromEntries(categories.map((category) => [category.slug, category]));

  const cuentaVista = await prisma.account.create({
    data: {
      workspaceId: workspace.id,
      name: "Cuenta Vista Banco de Chile",
      institution: "Banco de Chile",
      type: AccountType.CUENTA_VISTA,
      businessUnitId: personal.id
    }
  });

  const cuentaBci = await prisma.account.create({
    data: {
      workspaceId: workspace.id,
      name: "Cuenta Corriente BCI",
      institution: "BCI",
      type: AccountType.CUENTA_CORRIENTE,
      businessUnitId: personal.id
    }
  });

  const cmr = await prisma.account.create({
    data: {
      workspaceId: workspace.id,
      name: "Tarjeta CMR Falabella",
      institution: "Banco Falabella",
      type: AccountType.TARJETA_CREDITO,
      businessUnitId: personal.id
    }
  });

  const cuentaEmpresa = await prisma.account.create({
    data: {
      workspaceId: workspace.id,
      name: "Cuenta Empresa BancoEstado",
      institution: "BancoEstado",
      type: AccountType.CUENTA_CORRIENTE,
      isBusiness: true,
      businessUnitId: detallesChile.id
    }
  });

  const demoTransactions = [
    {
      date: "2026-03-18",
      description: "Meta Ads Look Hair - campaña Providencia",
      amount: -185000,
      type: TransactionType.EGRESO,
      financialOrigin: FinancialOrigin.EMPRESA,
      accountId: cmr.id,
      categoryId: categoryBySlug["publicidad-digital"].id,
      businessUnitId: lookHair.id,
      reviewStatus: ReviewStatus.PENDIENTE,
      isBusinessPaidPersonally: true,
      isReimbursable: true
    },
    {
      date: "2026-03-18",
      description: "Uber Centro Santiago",
      amount: -22900,
      type: TransactionType.EGRESO,
      financialOrigin: FinancialOrigin.EMPRESA,
      accountId: cuentaVista.id,
      categoryId: categoryBySlug["transporte"].id,
      businessUnitId: houseOfHair.id,
      reviewStatus: ReviewStatus.REVISADO,
      isBusinessPaidPersonally: true,
      isReimbursable: true
    },
    {
      date: "2026-03-17",
      description: "Transferencia cliente ramos y rosas eternas",
      amount: 129900,
      type: TransactionType.INGRESO,
      financialOrigin: FinancialOrigin.EMPRESA,
      accountId: cuentaEmpresa.id,
      categoryId: categoryBySlug["ventas"].id,
      businessUnitId: detallesChile.id,
      reviewStatus: ReviewStatus.REVISADO,
      isBusinessPaidPersonally: false,
      isReimbursable: false
    },
    {
      date: "2026-03-16",
      description: "Arriendo depto comuna de Nunoa",
      amount: -620000,
      type: TransactionType.EGRESO,
      financialOrigin: FinancialOrigin.PERSONAL,
      accountId: cuentaBci.id,
      categoryId: categoryBySlug["arriendo-local"].id,
      businessUnitId: personal.id,
      reviewStatus: ReviewStatus.REVISADO,
      isBusinessPaidPersonally: false,
      isReimbursable: false
    },
    {
      date: "2026-03-15",
      description: "Compra insumos salon - shampoo, tintes y peinados",
      amount: -148000,
      type: TransactionType.EGRESO,
      financialOrigin: FinancialOrigin.EMPRESA,
      accountId: cmr.id,
      categoryId: categoryBySlug["insumos-belleza"].id,
      businessUnitId: lookHair.id,
      reviewStatus: ReviewStatus.PENDIENTE,
      isBusinessPaidPersonally: true,
      isReimbursable: true
    }
  ];

  for (const transaction of demoTransactions) {
    const account = [cuentaVista, cuentaBci, cmr, cuentaEmpresa].find(
      (item) => item.id === transaction.accountId
    );

    await prisma.transaction.create({
      data: {
        ...transaction,
        workspaceId: workspace.id,
        date: new Date(transaction.date),
        duplicateFingerprint: makeFingerprint({
          date: transaction.date,
          amount: transaction.amount,
          description: transaction.description,
          accountName: account?.name ?? "sin-cuenta"
        })
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
