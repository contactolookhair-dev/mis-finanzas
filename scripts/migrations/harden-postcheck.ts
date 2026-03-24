import { PrismaClient } from "@prisma/client";
import { gatherHardenPrecheck, TENANT_TABLES_WITH_WORKSPACE_ID } from "./harden-checks";

type ExistsRow = { exists: boolean };

async function indexExists(prisma: PrismaClient, indexName: string) {
  const rows = await prisma.$queryRawUnsafe<ExistsRow[]>(
    `SELECT EXISTS(
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = '${indexName}'
    ) AS exists`
  );
  return rows[0]?.exists === true;
}

async function nonNullable(prisma: PrismaClient, table: string, column: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ is_nullable: string }>>(
    `SELECT is_nullable
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = '${table}'
       AND column_name = '${column}'`
  );

  return rows[0]?.is_nullable === "NO";
}

async function tableExists(prisma: PrismaClient, table: string) {
  const rows = await prisma.$queryRawUnsafe<ExistsRow[]>(
    `SELECT EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = '${table}'
    ) AS exists`
  );
  return rows[0]?.exists === true;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no está definido. Exporta la variable o crea .env antes de correr el postcheck."
    );
  }

  const prisma = new PrismaClient();
  try {
    console.log("=== POSTCHECK: HARDEN MULTI-TENANT + IMPORT IDEMPOTENCY ===");
    const report = await gatherHardenPrecheck(prisma);

    if (report.blockers.length > 0) {
      console.log("Se detectaron bloqueos de datos después de migrar:");
      report.blockers.forEach((item) => console.log(`- ${item}`));
      process.exitCode = 1;
      return;
    }

    const requiredIndexes = [
      "BusinessUnit_workspaceId_slug_key",
      "Category_workspaceId_slug_key",
      "Subcategory_workspaceId_slug_key",
      "UserSettings_workspaceId_userKey_key",
      "AppSettings_workspaceId_key",
      "AISettings_workspaceId_key",
      "DashboardSettings_workspaceId_key",
      "Transaction_workspaceId_duplicateFingerprint_key"
    ];

    const indexChecks = await Promise.all(
      requiredIndexes.map(async (indexName) => [indexName, await indexExists(prisma, indexName)] as const)
    );

    const missingIndexes = indexChecks.filter(([, exists]) => !exists).map(([name]) => name);

    const nullableChecks = await Promise.all(
      TENANT_TABLES_WITH_WORKSPACE_ID.map(async (table) => ({
        table,
        isNotNull: await nonNullable(prisma, table, "workspaceId")
      }))
    );

    const nullableFailures = nullableChecks.filter((item) => !item.isNotNull).map((item) => item.table);
    const importBatchExists = await tableExists(prisma, "ImportBatch");

    console.log(`ImportBatch existe: ${importBatchExists ? "SI" : "NO"}`);
    console.log(`Indices críticos faltantes: ${missingIndexes.length}`);
    missingIndexes.forEach((item) => console.log(`- ${item}`));
    console.log(`Columnas workspaceId aún nullable: ${nullableFailures.length}`);
    nullableFailures.forEach((item) => console.log(`- ${item}`));

    if (!importBatchExists || missingIndexes.length > 0 || nullableFailures.length > 0) {
      process.exitCode = 1;
      return;
    }

    console.log("Postcheck DB aprobado: constraints e índices críticos activos.");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error("Error en postcheck:", error);
  process.exit(1);
});
