import { prisma } from "@/server/db/prisma";

function money(n: number) {
  return n;
}

async function main() {
  const targetName = "Sebastian Molina";
  const reasonContains = "macbook";

  const workspaceIds = (
    await prisma.debtor.findMany({
      where: {
        name: { contains: "Sebastian", mode: "insensitive" }
      },
      select: { workspaceId: true },
      distinct: ["workspaceId"]
    })
  ).map((r) => r.workspaceId);

  if (workspaceIds.length === 0) {
    console.error("[recover] No encontré ningún workspace con deudas de 'Sebastian'.");
    console.error("[recover] Aborta para evitar escribir en un workspace incorrecto.");
    process.exitCode = 1;
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

  const workspaceId = scored[0]!.workspaceId;

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

  // Values based on the real UI example we had:
  // Total compra: 1.452.174
  // Cuota: 242.029
  // Cuota 2 de 6 => paidInstallments = 1
  const totalPurchase = money(1_452_174);
  const installmentCount = 6;
  const installmentValue = money(242_029);
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
}

main()
  .catch((err) => {
    console.error("[recover] ERROR", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

