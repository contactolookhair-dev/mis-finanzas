import { PrismaClient } from "@prisma/client";
import { gatherHardenPrecheck } from "./harden-checks";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no está definido. Exporta la variable o crea .env antes de correr el precheck."
    );
  }

  const prisma = new PrismaClient();
  try {
    const report = await gatherHardenPrecheck(prisma);

    console.log("=== PRECHECK: HARDEN MULTI-TENANT + IMPORT IDEMPOTENCY ===");
    console.log(`Generated at: ${report.generatedAt}`);
    console.log("");
    console.log("workspaceId nulo por tabla:");
    Object.entries(report.nullWorkspaceByTable).forEach(([table, count]) => {
      console.log(`- ${table}: ${count}`);
    });
    console.log("");
    console.log(`Duplicados slug BusinessUnit: ${report.duplicateSlugs.businessUnit.length}`);
    console.log(`Duplicados slug Category: ${report.duplicateSlugs.category.length}`);
    console.log(`Duplicados slug Subcategory: ${report.duplicateSlugs.subcategory.length}`);
    console.log(`DuplicateFingerprint repetidos: ${report.duplicateFingerprints.length}`);
    console.log(
      `UserSettings duplicados (workspaceId+userKey): ${report.duplicateSettings.userSettingsWorkspaceUser.length}`
    );
    console.log(`AppSettings duplicados por workspace: ${report.duplicateSettings.appSettingsWorkspace.length}`);
    console.log(`AISettings duplicados por workspace: ${report.duplicateSettings.aiSettingsWorkspace.length}`);
    console.log(
      `DashboardSettings duplicados por workspace: ${report.duplicateSettings.dashboardSettingsWorkspace.length}`
    );
    console.log(`UserSettings con userKey nulo: ${report.duplicateSettings.nullUserKeyInUserSettings}`);
    console.log("");

    if (report.blockers.length > 0) {
      console.log("BLOQUEOS DETECTADOS:");
      report.blockers.forEach((item) => console.log(`- ${item}`));
      process.exitCode = 1;
      return;
    }

    console.log("Sin bloqueos. Base compatible para aplicar constraints.");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error("Error ejecutando precheck:", error);
  process.exit(1);
});
