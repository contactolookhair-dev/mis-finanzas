import { prisma } from "@/server/db/prisma";
import { BusinessUnitType } from "@prisma/client";

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function createBusinessUnit(input: {
  workspaceId: string;
  name: string;
  type?: BusinessUnitType;
  description?: string | null;
  color?: string | null;
}) {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new Error("Nombre de negocio inválido.");
  }

  const existing = await prisma.businessUnit.findFirst({
    where: { workspaceId: input.workspaceId, isActive: true, name: { equals: name, mode: "insensitive" } }
  });
  if (existing) return existing;

  let slug = slugify(name);
  if (!slug) slug = "negocio";
  let suffix = 1;
  while (
    await prisma.businessUnit.findFirst({
      where: { workspaceId: input.workspaceId, slug },
      select: { id: true }
    })
  ) {
    slug = `${slugify(name)}-${suffix}`;
    suffix += 1;
  }

  return prisma.businessUnit.create({
    data: {
      workspaceId: input.workspaceId,
      name,
      slug,
      type: input.type ?? BusinessUnitType.NEGOCIO,
      description: input.description ?? null,
      color: input.color ?? null
    }
  });
}
