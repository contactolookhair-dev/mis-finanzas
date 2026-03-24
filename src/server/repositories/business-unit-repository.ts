import { prisma } from "@/server/db/prisma";

export async function listBusinessUnits(workspaceId: string) {
  return prisma.businessUnit.findMany({
    where: { isActive: true, workspaceId },
    orderBy: [{ type: "asc" }, { name: "asc" }]
  });
}

export async function findBusinessUnitByName(name: string, workspaceId: string) {
  return prisma.businessUnit.findFirst({
    where: {
      workspaceId,
      isActive: true,
      name: {
        equals: name,
        mode: "insensitive"
      }
    }
  });
}
