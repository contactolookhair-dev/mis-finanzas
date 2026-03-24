import { prisma } from "@/server/db/prisma";

export async function listAccounts(workspaceId: string) {
  return prisma.account.findMany({
    where: { isActive: true, workspaceId },
    orderBy: [{ isBusiness: "asc" }, { name: "asc" }]
  });
}

export async function listAccountsIncludingInactive(workspaceId: string) {
  return prisma.account.findMany({
    where: { workspaceId },
    orderBy: [{ isActive: "desc" }, { isBusiness: "asc" }, { name: "asc" }]
  });
}
