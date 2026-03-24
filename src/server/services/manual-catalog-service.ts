import { CategoryType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

const DEFAULT_CATEGORY_NAMES = [
  "Comida",
  "Transporte",
  "Bencina",
  "Ropa",
  "Salud",
  "Hogar",
  "Servicios",
  "Ocio",
  "Empresa",
  "Otros"
] as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function createCategoryIfMissing(workspaceId: string, name: string) {
  const existing = await prisma.category.findFirst({
    where: {
      workspaceId,
      name: { equals: name, mode: "insensitive" }
    }
  });
  if (existing) return existing;

  let slug = slugify(name);
  if (!slug) slug = "categoria";
  let suffix = 1;
  while (
    await prisma.category.findFirst({
      where: {
        workspaceId,
        slug
      },
      select: { id: true }
    })
  ) {
    slug = `${slugify(name)}-${suffix}`;
    suffix += 1;
  }

  return prisma.category.create({
    data: {
      workspaceId,
      name,
      slug,
      type: CategoryType.EGRESO
    }
  });
}

export async function ensureDefaultCategories(workspaceId: string) {
  await Promise.all(DEFAULT_CATEGORY_NAMES.map((name) => createCategoryIfMissing(workspaceId, name)));
}

export async function listManualCategories(workspaceId: string) {
  await ensureDefaultCategories(workspaceId);
  return prisma.category.findMany({
    where: { workspaceId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function createManualCategory(workspaceId: string, name: string) {
  return createCategoryIfMissing(workspaceId, name.trim());
}
