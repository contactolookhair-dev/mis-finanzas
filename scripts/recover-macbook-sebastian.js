/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");

function money(n) {
  return n;
}

function loadDotEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

async function main() {
  // Ensure local runs match the app environment.
  loadDotEnvFile(path.join(process.cwd(), ".env.local"));
  loadDotEnvFile(path.join(process.cwd(), ".env"));

  const prisma = new PrismaClient();
  try {
    const targetName = "Sebastian Molina";
    const reasonContains = "macbook";

    const [debtorTotal, txTotal] = await Promise.all([
      prisma.debtor.count(),
      prisma.transaction.count()
    ]);
    console.log("[recover] totals", { debtorTotal, txTotal });

    const sebastianLike = await prisma.debtor.findMany({
      where: {
        OR: [
          { name: { contains: "Sebastian", mode: "insensitive" } },
          { name: { contains: "Molina", mode: "insensitive" } },
          { reason: { contains: "MacBook", mode: "insensitive" } }
        ]
      },
      select: { id: true, workspaceId: true, name: true, reason: true, totalAmount: true },
      take: 30,
      orderBy: { updatedAt: "desc" }
    });

    const workspaceIds = [...new Set(sebastianLike.map((d) => d.workspaceId))];

    if (workspaceIds.length === 0) {
      console.error("[recover] No pude identificar el workspace correcto (no encontré deudas que coincidan).");
      const sample = await prisma.debtor.findMany({
        select: { workspaceId: true, name: true, reason: true, totalAmount: true },
        take: 12,
        orderBy: { updatedAt: "desc" }
      });
      console.log("[recover] debtor sample (latest 12)", sample);
      console.log("[recover] hint: revisa que DATABASE_URL en .env.local sea el mismo que usa tu app.");
      process.exitCode = 2;
      return;
    }

    const scored = await Promise.all(
      workspaceIds.map(async (workspaceId) => {
        const [txCount, debtorCount] = await Promise.all([
          prisma.transaction.count({ where: { workspaceId } }),
          prisma.debtor.count({ where: { workspaceId } })
        ]);
        return { workspaceId, txCount, debtorCount };
      })
    );

    scored.sort((a, b) => {
      if (b.txCount !== a.txCount) return b.txCount - a.txCount;
      return b.debtorCount - a.debtorCount;
    });

    const workspaceId = scored[0].workspaceId;
    console.log("[recover] candidate workspaces", scored);
    console.log("[recover] picked workspaceId", workspaceId);

    const existing = await prisma.debtor.findFirst({
      where: {
        workspaceId,
        name: { equals: targetName, mode: "insensitive" },
        reason: { contains: reasonContains, mode: "insensitive" }
      },
      select: { id: true, name: true, reason: true, totalAmount: true, isInstallmentDebt: true, installmentCount: true }
    });

    if (existing) {
      console.log("[recover] Ya existe una deuda MacBook para Sebastian. No hago cambios.", existing);
      return;
    }

    const existingSebastianDebtors = await prisma.debtor.findMany({
      where: { workspaceId, name: { contains: "Sebastian", mode: "insensitive" } },
      select: { id: true, name: true, reason: true, totalAmount: true, status: true, notes: true },
      take: 10,
      orderBy: { updatedAt: "desc" }
    });
    console.log("[recover] existing Sebastian debtors (latest)", existingSebastianDebtors);

    // Values based on the real UI example we had:
    // Total compra: 1.452.174
    // Cuota: 242.029
    // Cuota 2 de 6 => paidInstallments = 1
    const totalPurchase = money(1452174);
    const installmentCount = 6;
    const installmentValue = money(242029);
    const paidInstallments = 1;

    const created = await prisma.debtor.create({
      data: {
        workspaceId,
        name: targetName,
        reason: "MacBook Air",
        totalAmount: totalPurchase,
        paidAmount: 0,
        startDate: new Date("2026-03-01T12:00:00"),
        estimatedPayDate: null,
        status: "PENDIENTE",
        isInstallmentDebt: true,
        installmentCount,
        installmentValue,
        paidInstallments,
        installmentFrequency: "MENSUAL",
        nextInstallmentDate: new Date("2026-04-02T12:00:00"),
        notes: "recuperado:script"
      },
      select: { id: true, workspaceId: true, name: true, reason: true, totalAmount: true }
    });

    console.log("[recover] Deuda recreada OK", created);
    console.log("[recover] Workspace elegido", scored[0]);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[recover] ERROR", err);
  process.exitCode = 1;
});
