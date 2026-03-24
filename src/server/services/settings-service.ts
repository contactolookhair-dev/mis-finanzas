import { appConfig } from "@/lib/config/app-config";
import {
  getSettingsSnapshot,
  upsertAISettings,
  upsertAppSettings,
  upsertDashboardSettings,
  upsertUserRegionalPreferences
} from "@/server/repositories/settings-repository";
import type {
  AISettingsPayload,
  AppSettingsPayload,
  DashboardSettingsPayload,
  UserRegionalPreferences
} from "@/shared/types/settings";

function defaultAppSettings(): AppSettingsPayload {
  return {
    dashboardModules: [...appConfig.modules],
    enabledModules: [...appConfig.modules],
    suggestedAiQuestions: [...appConfig.suggestedAiQuestions],
    transactionLabels: {
      pendiente: "Pendiente",
      revisado: "Revisado",
      observado: "Observado"
    },
    importSettings: {
      allowedFormats: ["csv", "xlsx", "pdf"]
    }
  };
}

function defaultAISettings(): AISettingsPayload {
  return {
    modelProvider: "internal",
    modelName: "financial-assistant-v1",
    isEnabled: true,
    systemPrompt: "Asistente financiero conectado solo a datos internos de la app.",
    responseTone: "claro-profesional",
    responseDetailLevel: "medio",
    suggestedQuestions: [...appConfig.suggestedAiQuestions],
    insightParameters: {
      expenseWarningPct: 15,
      criticalPersonalMoney: 1000000,
      categoryGrowthWarningPct: 18,
      businessUnitGrowthWarningPct: 18,
      concentrationWarningPct: 45,
      recommendationAggressiveness: 60,
      enabledInsightTypes: [
        "expense_growth",
        "category_spike",
        "business_unit_spike",
        "expense_concentration",
        "personal_money_in_business",
        "review_backlog"
      ]
    }
  };
}

function defaultDashboardSettings(): DashboardSettingsPayload {
  return {
    layoutConfig: {
      mobile: ["kpis", "trend", "categories", "business_units", "insights"],
      desktop: ["kpis", "trend", "business_units", "categories", "insights"]
    },
    defaultDateRangeDays: 30,
    visibleWidgets: ["kpis", "trend", "category_breakdown", "business_breakdown", "insights"],
    kpiDefinitions: {
      flujoNeto: "ingresos - egresos",
      dineroPersonalEnEmpresas: "suma de egresos empresariales pagados con fondos personales"
    }
  };
}

function defaultRegionalPreferences(): UserRegionalPreferences {
  return {
    language: appConfig.region.locale,
    locale: appConfig.region.locale,
    currencyCode: appConfig.region.currencyCode,
    currencySymbol: appConfig.region.currencySymbol,
    dateFormat: appConfig.region.dateFormat
  };
}

export async function getResolvedSettings(workspaceId: string, userKey: string) {
  const snapshot = await getSettingsSnapshot(workspaceId, userKey);

  return {
    appSettings: snapshot.appSettings ?? defaultAppSettings(),
    aiSettings: snapshot.aiSettings ?? defaultAISettings(),
    dashboardSettings: snapshot.dashboardSettings ?? defaultDashboardSettings(),
    userSettings: snapshot.userSettings ?? defaultRegionalPreferences(),
    modules: snapshot.modules
  };
}

export async function updateConfigSettings(input: {
  workspaceId: string;
  userKey: string;
  appSettings?: AppSettingsPayload;
  aiSettings?: AISettingsPayload;
  dashboardSettings?: DashboardSettingsPayload;
  regionalPreferences?: UserRegionalPreferences;
}) {
  const tasks: Promise<unknown>[] = [];

  if (input.appSettings) {
    tasks.push(upsertAppSettings(input.workspaceId, input.appSettings));
  }

  if (input.aiSettings) {
    tasks.push(upsertAISettings(input.workspaceId, input.aiSettings));
  }

  if (input.dashboardSettings) {
    tasks.push(upsertDashboardSettings(input.workspaceId, input.dashboardSettings));
  }

  if (input.regionalPreferences) {
    tasks.push(
      upsertUserRegionalPreferences(input.workspaceId, input.userKey, input.regionalPreferences)
    );
  }

  await Promise.all(tasks);
  return getResolvedSettings(input.workspaceId, input.userKey);
}
