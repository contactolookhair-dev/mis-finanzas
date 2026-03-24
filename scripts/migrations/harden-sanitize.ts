import { Prisma, PrismaClient } from "@prisma/client";
import { gatherHardenPrecheck } from "./harden-checks";

const apply = process.argv.includes("--apply");

async function ensureDefaultWorkspaceId(tx: Prisma.TransactionClient) {
  const firstWorkspace = await tx.workspace.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" }
  });
  if (firstWorkspace) {
    return firstWorkspace.id;
  }

  const created = await tx.workspace.create({
    data: {
      id: "legacy-workspace",
      name: "Legacy Workspace",
      slug: `legacy-workspace-${Date.now()}`,
      description: "Workspace generado automáticamente por saneamiento pre-migración.",
      isActive: true
    },
    select: { id: true }
  });
  return created.id;
}

async function fixDuplicateSlugs(
  tx: Prisma.TransactionClient,
  table: "BusinessUnit" | "Category" | "Subcategory"
) {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string; slug: string; rank: number }>>(
    `SELECT "id", "slug",
            ROW_NUMBER() OVER (
              PARTITION BY "workspaceId", "slug"
              ORDER BY "createdAt" ASC, "id" ASC
            ) AS rank
     FROM "${table}"
     WHERE "slug" IS NOT NULL`
  );

  const duplicatedRows = rows.filter((row) => row.rank > 1);
  for (const row of duplicatedRows) {
    const suffix = row.id.slice(0, 6).toLowerCase();
    const nextSlug = `${row.slug}-${suffix}`;
    await tx.$executeRawUnsafe(`UPDATE "${table}" SET "slug" = $1 WHERE "id" = $2`, nextSlug, row.id);
  }

  return duplicatedRows.length;
}

async function sanitizeData(tx: Prisma.TransactionClient, defaultWorkspaceId: string) {
  const result: Record<string, number> = {};

  result.backfillBusinessUnit = await tx.$executeRaw(
    Prisma.sql`UPDATE "BusinessUnit" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );
  result.backfillCategory = await tx.$executeRaw(
    Prisma.sql`UPDATE "Category" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );

  result.backfillSubcategoryFromCategory = await tx.$executeRawUnsafe(
    `UPDATE "Subcategory" "target"
     SET "workspaceId" = "category"."workspaceId"
     FROM "Category" "category"
     WHERE "target"."workspaceId" IS NULL
       AND "target"."categoryId" = "category"."id"`
  );
  result.backfillSubcategoryDefault = await tx.$executeRaw(
    Prisma.sql`UPDATE "Subcategory" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );

  result.backfillAccountFromBusinessUnit = await tx.$executeRawUnsafe(
    `UPDATE "Account" "target"
     SET "workspaceId" = "unit"."workspaceId"
     FROM "BusinessUnit" "unit"
     WHERE "target"."workspaceId" IS NULL
       AND "target"."businessUnitId" = "unit"."id"`
  );
  result.backfillAccountDefault = await tx.$executeRaw(
    Prisma.sql`UPDATE "Account" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );

  result.backfillTransactionByRelations = await tx.$executeRawUnsafe(
    `UPDATE "Transaction" "target"
     SET "workspaceId" = COALESCE(
       (SELECT "workspaceId" FROM "Account" WHERE "id" = "target"."accountId"),
       (SELECT "workspaceId" FROM "Category" WHERE "id" = "target"."categoryId"),
       (SELECT "workspaceId" FROM "Subcategory" WHERE "id" = "target"."subcategoryId"),
       (SELECT "workspaceId" FROM "BusinessUnit" WHERE "id" = "target"."businessUnitId")
     )
     WHERE "target"."workspaceId" IS NULL`
  );
  result.backfillTransactionDefault = await tx.$executeRaw(
    Prisma.sql`UPDATE "Transaction" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );

  result.backfillClassificationRuleByRelations = await tx.$executeRawUnsafe(
    `UPDATE "ClassificationRule" "target"
     SET "workspaceId" = COALESCE(
       (SELECT "workspaceId" FROM "Category" WHERE "id" = "target"."categoryId"),
       (SELECT "workspaceId" FROM "Subcategory" WHERE "id" = "target"."subcategoryId"),
       (SELECT "workspaceId" FROM "BusinessUnit" WHERE "id" = "target"."businessUnitId")
     )
     WHERE "target"."workspaceId" IS NULL`
  );
  result.backfillClassificationRuleDefault = await tx.$executeRaw(
    Prisma.sql`UPDATE "ClassificationRule" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );

  result.backfillImportTemplateConfig = await tx.$executeRaw(
    Prisma.sql`UPDATE "ImportTemplateConfig" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );
  result.backfillFixedExpense = await tx.$executeRawUnsafe(
    `UPDATE "FixedExpense" "target"
     SET "workspaceId" = COALESCE(
       (SELECT "workspaceId" FROM "Account" WHERE "id" = "target"."accountId"),
       (SELECT "workspaceId" FROM "Category" WHERE "id" = "target"."categoryId"),
       (SELECT "workspaceId" FROM "BusinessUnit" WHERE "id" = "target"."businessUnitId")
     )
     WHERE "target"."workspaceId" IS NULL`
  );
  result.backfillFixedExpenseDefault = await tx.$executeRaw(
    Prisma.sql`UPDATE "FixedExpense" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );

  result.backfillVariableExpense = await tx.$executeRawUnsafe(
    `UPDATE "VariableExpense" "target"
     SET "workspaceId" = COALESCE(
       (SELECT "workspaceId" FROM "Account" WHERE "id" = "target"."accountId"),
       (SELECT "workspaceId" FROM "Category" WHERE "id" = "target"."categoryId"),
       (SELECT "workspaceId" FROM "BusinessUnit" WHERE "id" = "target"."businessUnitId")
     )
     WHERE "target"."workspaceId" IS NULL`
  );
  result.backfillVariableExpenseDefault = await tx.$executeRaw(
    Prisma.sql`UPDATE "VariableExpense" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );

  result.backfillDebtor = await tx.$executeRaw(
    Prisma.sql`UPDATE "Debtor" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );

  result.backfillReimbursement = await tx.$executeRawUnsafe(
    `UPDATE "Reimbursement" "target"
     SET "workspaceId" = COALESCE(
       (SELECT "workspaceId" FROM "Transaction" WHERE "id" = "target"."transactionId"),
       (SELECT "workspaceId" FROM "BusinessUnit" WHERE "id" = "target"."businessUnitId"),
       (SELECT "workspaceId" FROM "Account" WHERE "id" = "target"."personalAccountId")
     )
     WHERE "target"."workspaceId" IS NULL`
  );
  result.backfillReimbursementDefault = await tx.$executeRaw(
    Prisma.sql`UPDATE "Reimbursement" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );

  result.backfillUserSettingsWorkspace = await tx.$executeRaw(
    Prisma.sql`UPDATE "UserSettings" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );
  result.normalizeUserSettingsUserKey = await tx.$executeRawUnsafe(
    `UPDATE "UserSettings" SET "userKey" = 'system' WHERE "userKey" IS NULL`
  );

  result.backfillAppSettings = await tx.$executeRaw(
    Prisma.sql`UPDATE "AppSettings" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );
  result.backfillAISettings = await tx.$executeRaw(
    Prisma.sql`UPDATE "AISettings" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );
  result.backfillDashboardSettings = await tx.$executeRaw(
    Prisma.sql`UPDATE "DashboardSettings" SET "workspaceId" = ${defaultWorkspaceId} WHERE "workspaceId" IS NULL`
  );

  result.fixedBusinessUnitSlugs = await fixDuplicateSlugs(tx, "BusinessUnit");
  result.fixedCategorySlugs = await fixDuplicateSlugs(tx, "Category");
  result.fixedSubcategorySlugs = await fixDuplicateSlugs(tx, "Subcategory");

  result.dedupeUserSettings = await tx.$executeRawUnsafe(
    `WITH dedupe AS (
       SELECT
         "id",
         ROW_NUMBER() OVER (
           PARTITION BY "workspaceId", "userKey"
           ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
         ) AS "rownum"
       FROM "UserSettings"
     )
     DELETE FROM "UserSettings" "target"
     USING dedupe
     WHERE "target"."id" = dedupe."id"
       AND dedupe."rownum" > 1`
  );

  result.dedupeAppSettings = await tx.$executeRawUnsafe(
    `WITH dedupe AS (
       SELECT
         "id",
         ROW_NUMBER() OVER (
           PARTITION BY "workspaceId"
           ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
         ) AS "rownum"
       FROM "AppSettings"
     )
     DELETE FROM "AppSettings" "target"
     USING dedupe
     WHERE "target"."id" = dedupe."id"
       AND dedupe."rownum" > 1`
  );

  result.dedupeAISettings = await tx.$executeRawUnsafe(
    `WITH dedupe AS (
       SELECT
         "id",
         ROW_NUMBER() OVER (
           PARTITION BY "workspaceId"
           ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
         ) AS "rownum"
       FROM "AISettings"
     )
     DELETE FROM "AISettings" "target"
     USING dedupe
     WHERE "target"."id" = dedupe."id"
       AND dedupe."rownum" > 1`
  );

  result.dedupeDashboardSettings = await tx.$executeRawUnsafe(
    `WITH dedupe AS (
       SELECT
         "id",
         ROW_NUMBER() OVER (
           PARTITION BY "workspaceId"
           ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
         ) AS "rownum"
       FROM "DashboardSettings"
     )
     DELETE FROM "DashboardSettings" "target"
     USING dedupe
     WHERE "target"."id" = dedupe."id"
       AND dedupe."rownum" > 1`
  );

  result.nullifyDuplicateFingerprints = await tx.$executeRawUnsafe(
    `WITH ranked_fingerprints AS (
       SELECT
         "id",
         ROW_NUMBER() OVER (
           PARTITION BY "workspaceId", "duplicateFingerprint"
           ORDER BY "createdAt" ASC, "id" ASC
         ) AS "rownum"
       FROM "Transaction"
       WHERE "duplicateFingerprint" IS NOT NULL
     )
     UPDATE "Transaction" "target"
     SET "duplicateFingerprint" = NULL
     FROM ranked_fingerprints
     WHERE "target"."id" = ranked_fingerprints."id"
       AND ranked_fingerprints."rownum" > 1`
  );

  return result;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no está definido. Exporta la variable o crea .env antes de correr el saneamiento."
    );
  }

  const prisma = new PrismaClient();
  try {
    const before = await gatherHardenPrecheck(prisma);
    console.log("=== SANITIZE PRE-MIGRATION (HARDEN) ===");
    console.log(`Modo: ${apply ? "APPLY" : "DRY-RUN"}`);
    console.log(`Bloqueos detectados antes: ${before.blockers.length}`);
    if (before.blockers.length > 0) {
      before.blockers.forEach((item) => console.log(`- ${item}`));
    }

    if (!apply) {
      console.log("");
      console.log("Dry-run finalizado. Ejecuta con --apply para aplicar saneamiento.");
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const defaultWorkspaceId = await ensureDefaultWorkspaceId(tx);
      const changes = await sanitizeData(tx, defaultWorkspaceId);
      return { defaultWorkspaceId, changes };
    });

    console.log("");
    console.log(`Workspace por defecto usado para backfill: ${result.defaultWorkspaceId}`);
    console.log("Cambios aplicados:");
    Object.entries(result.changes).forEach(([key, value]) => {
      console.log(`- ${key}: ${value}`);
    });

    const after = await gatherHardenPrecheck(prisma);
    console.log("");
    console.log(`Bloqueos detectados después: ${after.blockers.length}`);
    if (after.blockers.length > 0) {
      after.blockers.forEach((item) => console.log(`- ${item}`));
      process.exitCode = 1;
      return;
    }
    console.log("Saneamiento completado, sin bloqueos pendientes.");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error("Error en saneamiento pre-migración:", error);
  process.exit(1);
});
