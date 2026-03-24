import { prisma } from "@/server/db/prisma";

export async function listAccounts(workspaceId: string) {
  return prisma.account.findMany({
    where: { isActive: true, workspaceId },
    orderBy: [{ isBusiness: "asc" }, { name: "asc" }]
  });
}
