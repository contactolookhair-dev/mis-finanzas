import { prisma } from "@/server/db/prisma";

export async function listDebtors(workspaceId: string) {
  return prisma.debtor.findMany({
    where: { workspaceId },
    include: {
      payments: {
        orderBy: { paidAt: "desc" }
      }
    },
    orderBy: { updatedAt: "desc" }
  });
}
