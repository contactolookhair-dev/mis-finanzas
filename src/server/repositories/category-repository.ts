import { prisma } from "@/server/db/prisma";

export async function listCategories(workspaceId: string) {
  return prisma.category.findMany({
    where: { isActive: true, workspaceId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function findCategoryByName(name: string, workspaceId: string) {
  return prisma.category.findFirst({
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
