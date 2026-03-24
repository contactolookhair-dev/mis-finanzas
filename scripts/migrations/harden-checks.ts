import { PrismaClient } from "@prisma/client";

type CountRow = { count: bigint | number };
type DuplicateRow = { workspace_id: string | null; value: string | null; count: bigint | number };

function asNumber(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}

async function countWhere(prisma: PrismaClient, table: string, conditionSql: string) {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE ${conditionSql}`
  );
  return asNumber(rows[0]?.count ?? 0);
}

async function findDuplicates(
  prisma: PrismaClient,
  table: string,
  valueColumn: string,
  whereSql = "TRUE",
  limit = 50
) {
  const rows = await prisma.$queryRawUnsafe<DuplicateRow[]>(
    `SELECT "workspaceId"::text AS workspace_id, "${valueColumn}"::text AS value, COUNT(*)::bigint AS count
     FROM "${table}"
     WHERE ${whereSql}
     GROUP BY "workspaceId", "${valueColumn}"
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC
     LIMIT ${limit}`
  );

  return rows.map((row) => ({
    workspaceId: row.workspace_id,
    value: row.value,
    count: asNumber(row.count)
  }));
}

export type HardenPrecheckReport = {
  generatedAt: string;
  nullWorkspaceByTable: Record<string, number>;
  duplicateSlugs: {
    businessUnit: Array<{ workspaceId: string | null; value: string | null; count: number }>;
    category: Array<{ workspaceId: string | null; value: string | null; count: number }>;
    subcategory: Array<{ workspaceId: string | null; value: string | null; count: number }>;
  };
  duplicateFingerprints: Array<{ workspaceId: string | null; value: string | null; count: number }>;
  duplicateSettings: {
    userSettingsWorkspaceUser: Array<{ workspaceId: string | null; value: string | null; count: number }>;
    appSettingsWorkspace: Array<{ workspaceId: string | null; value: string | null; count: number }>;
    aiSettingsWorkspace: Array<{ workspaceId: string | null; value: string | null; count: number }>;
    dashboardSettingsWorkspace: Array<{ workspaceId: string | null; value: string | null; count: number }>;
    nullUserKeyInUserSettings: number;
  };
  blockers: string[];
};

export const TENANT_TABLES_WITH_WORKSPACE_ID = [
  "BusinessUnit",
  "Account",
  "Category",
  "Subcategory",
  "Transaction",
  "ClassificationRule",
  "ImportTemplateConfig",
  "FixedExpense",
  "VariableExpense",
  "Debtor",
  "Reimbursement",
  "UserSettings",
  "AppSettings",
  "AISettings",
  "DashboardSettings"
] as const;

export async function gatherHardenPrecheck(prisma: PrismaClient): Promise<HardenPrecheckReport> {
  const nullWorkspaceEntries = await Promise.all(
    TENANT_TABLES_WITH_WORKSPACE_ID.map(async (table) => {
      const count = await countWhere(prisma, table, `"workspaceId" IS NULL`);
      return [table, count] as const;
    })
  );
  const nullWorkspaceByTable = Object.fromEntries(nullWorkspaceEntries);

  const [businessUnitSlugDuplicates, categorySlugDuplicates, subcategorySlugDuplicates] = await Promise.all([
    findDuplicates(prisma, "BusinessUnit", "slug", `"slug" IS NOT NULL`),
    findDuplicates(prisma, "Category", "slug", `"slug" IS NOT NULL`),
    findDuplicates(prisma, "Subcategory", "slug", `"slug" IS NOT NULL`)
  ]);

  const [duplicateFingerprints, userSettingsWorkspaceUser, appSettingsWorkspace, aiSettingsWorkspace, dashboardSettingsWorkspace, nullUserKeyInUserSettings] =
    await Promise.all([
      findDuplicates(prisma, "Transaction", "duplicateFingerprint", `"duplicateFingerprint" IS NOT NULL`),
      prisma.$queryRawUnsafe<
        Array<{ workspace_id: string | null; user_key: string | null; count: bigint | number }>
      >(
        `SELECT "workspaceId"::text AS workspace_id, "userKey"::text AS user_key, COUNT(*)::bigint AS count
         FROM "UserSettings"
         GROUP BY "workspaceId", "userKey"
         HAVING COUNT(*) > 1
         ORDER BY COUNT(*) DESC
         LIMIT 50`
      ),
      findDuplicates(prisma, "AppSettings", "workspaceId"),
      findDuplicates(prisma, "AISettings", "workspaceId"),
      findDuplicates(prisma, "DashboardSettings", "workspaceId"),
      countWhere(prisma, "UserSettings", `"userKey" IS NULL`)
    ]);

  const normalizedUserSettingsDuplicates = userSettingsWorkspaceUser.map((row) => ({
    workspaceId: row.workspace_id,
    value: row.user_key,
    count: asNumber(row.count)
  }));

  const blockers: string[] = [];
  for (const [table, count] of Object.entries(nullWorkspaceByTable)) {
    if (count > 0) blockers.push(`${table}: ${count} registros con workspaceId nulo`);
  }
  if (businessUnitSlugDuplicates.length > 0) blockers.push("BusinessUnit: slugs duplicados por workspace");
  if (categorySlugDuplicates.length > 0) blockers.push("Category: slugs duplicados por workspace");
  if (subcategorySlugDuplicates.length > 0) blockers.push("Subcategory: slugs duplicados por workspace");
  if (duplicateFingerprints.length > 0) blockers.push("Transaction: duplicateFingerprint repetido por workspace");
  if (normalizedUserSettingsDuplicates.length > 0) blockers.push("UserSettings: duplicados por workspaceId+userKey");
  if (appSettingsWorkspace.length > 0) blockers.push("AppSettings: más de una fila por workspace");
  if (aiSettingsWorkspace.length > 0) blockers.push("AISettings: más de una fila por workspace");
  if (dashboardSettingsWorkspace.length > 0) blockers.push("DashboardSettings: más de una fila por workspace");
  if (nullUserKeyInUserSettings > 0) blockers.push("UserSettings: userKey nulo");

  return {
    generatedAt: new Date().toISOString(),
    nullWorkspaceByTable,
    duplicateSlugs: {
      businessUnit: businessUnitSlugDuplicates,
      category: categorySlugDuplicates,
      subcategory: subcategorySlugDuplicates
    },
    duplicateFingerprints,
    duplicateSettings: {
      userSettingsWorkspaceUser: normalizedUserSettingsDuplicates,
      appSettingsWorkspace,
      aiSettingsWorkspace,
      dashboardSettingsWorkspace,
      nullUserKeyInUserSettings
    },
    blockers
  };
}
