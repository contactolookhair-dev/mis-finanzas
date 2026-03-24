import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { DashboardFilters } from "@/shared/types/dashboard";
import type {
  AISettingsPayload,
  AppSettingsPayload,
  DashboardSettingsPayload,
  UserRegionalPreferences
} from "@/shared/types/settings";

export async function getSettingsSnapshot(workspaceId: string, userKey: string) {
  const [appSettings, aiSettings, dashboardSettings, userSettings, modules] = await Promise.all([
    prisma.appSettings.findUnique({
      where: { workspaceId },
    }),
    prisma.aISettings.findUnique({
      where: { workspaceId },
    }),
    prisma.dashboardSettings.findUnique({
      where: { workspaceId },
    }),
    prisma.userSettings.findUnique({
      where: {
        workspaceId_userKey: {
          workspaceId,
          userKey
        }
      }
    }),
    prisma.workspaceModule.findMany({
      where: { workspaceId },
      orderBy: { label: "asc" }
    })
  ]);

  return {
    appSettings,
    aiSettings,
    dashboardSettings,
    userSettings,
    modules
  };
}

export async function upsertAppSettings(workspaceId: string, payload: AppSettingsPayload) {
  const data: Prisma.AppSettingsUncheckedCreateInput = {
    workspaceId,
    dashboardModules: payload.dashboardModules as Prisma.InputJsonValue,
    enabledModules: payload.enabledModules as Prisma.InputJsonValue,
    suggestedAiQuestions: payload.suggestedAiQuestions as Prisma.InputJsonValue,
    transactionLabels: payload.transactionLabels as Prisma.InputJsonValue,
    importSettings: payload.importSettings as Prisma.InputJsonValue
  };

  const updateData: Prisma.AppSettingsUncheckedUpdateInput = {
    dashboardModules: payload.dashboardModules as Prisma.InputJsonValue,
    enabledModules: payload.enabledModules as Prisma.InputJsonValue,
    suggestedAiQuestions: payload.suggestedAiQuestions as Prisma.InputJsonValue,
    transactionLabels: payload.transactionLabels as Prisma.InputJsonValue,
    importSettings: payload.importSettings as Prisma.InputJsonValue
  };

  return prisma.appSettings.upsert({
    where: { workspaceId },
    create: data,
    update: updateData
  });
}

export async function upsertAISettings(workspaceId: string, payload: AISettingsPayload) {
  const data: Prisma.AISettingsUncheckedCreateInput = {
    workspaceId,
    modelProvider: payload.modelProvider,
    modelName: payload.modelName,
    isEnabled: payload.isEnabled,
    systemPrompt: payload.systemPrompt,
    responseTone: payload.responseTone,
    responseDetailLevel: payload.responseDetailLevel,
    suggestedQuestions: payload.suggestedQuestions as Prisma.InputJsonValue,
    insightParameters: payload.insightParameters as Prisma.InputJsonValue
  };

  const updateData: Prisma.AISettingsUncheckedUpdateInput = {
    modelProvider: payload.modelProvider,
    modelName: payload.modelName,
    isEnabled: payload.isEnabled,
    systemPrompt: payload.systemPrompt,
    responseTone: payload.responseTone,
    responseDetailLevel: payload.responseDetailLevel,
    suggestedQuestions: payload.suggestedQuestions as Prisma.InputJsonValue,
    insightParameters: payload.insightParameters as Prisma.InputJsonValue
  };

  return prisma.aISettings.upsert({
    where: { workspaceId },
    create: data,
    update: updateData
  });
}

export async function upsertDashboardSettings(
  workspaceId: string,
  payload: DashboardSettingsPayload
) {
  const data: Prisma.DashboardSettingsUncheckedCreateInput = {
    workspaceId,
    layoutConfig: payload.layoutConfig as Prisma.InputJsonValue,
    defaultDateRangeDays: payload.defaultDateRangeDays,
    visibleWidgets: payload.visibleWidgets as Prisma.InputJsonValue,
    kpiDefinitions: payload.kpiDefinitions as Prisma.InputJsonValue
  };

  const updateData: Prisma.DashboardSettingsUncheckedUpdateInput = {
    layoutConfig: payload.layoutConfig as Prisma.InputJsonValue,
    defaultDateRangeDays: payload.defaultDateRangeDays,
    visibleWidgets: payload.visibleWidgets as Prisma.InputJsonValue,
    kpiDefinitions: payload.kpiDefinitions as Prisma.InputJsonValue
  };

  return prisma.dashboardSettings.upsert({
    where: { workspaceId },
    create: data,
    update: updateData
  });
}

export async function upsertUserRegionalPreferences(
  workspaceId: string,
  userKey: string,
  payload: UserRegionalPreferences
) {
  const data: Prisma.UserSettingsUncheckedCreateInput = {
    workspaceId,
    userKey,
    language: payload.language,
    locale: payload.locale,
    currencyCode: payload.currencyCode,
    currencySymbol: payload.currencySymbol,
    dateFormat: payload.dateFormat,
    defaultBusinessUnitId: payload.defaultBusinessUnitId
  };

  const updateData: Prisma.UserSettingsUncheckedUpdateInput = {
    language: payload.language,
    locale: payload.locale,
    currencyCode: payload.currencyCode,
    currencySymbol: payload.currencySymbol,
    dateFormat: payload.dateFormat,
    defaultBusinessUnitId: payload.defaultBusinessUnitId
  };

  return prisma.userSettings.upsert({
    where: {
      workspaceId_userKey: {
        workspaceId,
        userKey
      }
    },
    create: data,
    update: updateData
  });
}

export async function getUserDashboardFilters(workspaceId: string, userKey: string) {
  const settings = await prisma.userSettings.findUnique({
    where: {
      workspaceId_userKey: {
        workspaceId,
        userKey
      }
    },
    select: {
      dashboardFilters: true
    }
  });

  return (settings?.dashboardFilters ?? null) as DashboardFilters | null;
}

export async function upsertUserDashboardFilters(
  workspaceId: string,
  userKey: string,
  filters: DashboardFilters
) {
  return prisma.userSettings.upsert({
    where: {
      workspaceId_userKey: {
        workspaceId,
        userKey
      }
    },
    create: {
      workspaceId,
      userKey,
      dashboardFilters: filters as Prisma.InputJsonValue
    },
    update: {
      dashboardFilters: filters as Prisma.InputJsonValue
    }
  });
}
