import { z } from "zod";

export const moduleCodeSchema = z.string().min(2);

export const appSettingsPayloadSchema = z.object({
  dashboardModules: z.array(moduleCodeSchema),
  enabledModules: z.array(moduleCodeSchema),
  suggestedAiQuestions: z.array(z.string().min(3)),
  transactionLabels: z.record(z.string()),
  importSettings: z.record(z.unknown())
});

export const aiSettingsPayloadSchema = z.object({
  modelProvider: z.string().min(2).default("internal"),
  modelName: z.string().min(2).default("financial-assistant-v1"),
  isEnabled: z.boolean().default(true),
  systemPrompt: z.string().optional(),
  responseTone: z.string().min(2).default("claro-profesional"),
  responseDetailLevel: z.enum(["breve", "medio", "detallado"]).default("medio"),
  suggestedQuestions: z.array(z.string().min(3)),
  insightParameters: z.record(z.unknown())
});

export const dashboardSettingsPayloadSchema = z.object({
  layoutConfig: z.record(z.unknown()),
  defaultDateRangeDays: z.number().int().min(1).max(365),
  visibleWidgets: z.array(z.string()),
  kpiDefinitions: z.record(z.unknown())
});

export const userRegionalPreferencesSchema = z.object({
  language: z.string().default("es-CL"),
  locale: z.string().default("es-CL"),
  currencyCode: z.string().default("CLP"),
  currencySymbol: z.string().default("$"),
  dateFormat: z.string().default("dd-MM-yyyy"),
  defaultBusinessUnitId: z.string().optional()
});

export type AppSettingsPayload = z.infer<typeof appSettingsPayloadSchema>;
export type AISettingsPayload = z.infer<typeof aiSettingsPayloadSchema>;
export type DashboardSettingsPayload = z.infer<typeof dashboardSettingsPayloadSchema>;
export type UserRegionalPreferences = z.infer<typeof userRegionalPreferencesSchema>;

export type SettingsSectionCode =
  | "general"
  | "business_units"
  | "accounts"
  | "categories"
  | "classification_rules"
  | "ai"
  | "dashboard"
  | "regional_preferences";

export type SettingsSection = {
  code: SettingsSectionCode;
  title: string;
  description: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    code: "general",
    title: "General",
    description: "Módulos activos, etiquetas globales y parámetros base."
  },
  {
    code: "business_units",
    title: "Negocios",
    description: "Unidades de negocio y opciones operativas por unidad."
  },
  {
    code: "accounts",
    title: "Cuentas",
    description: "Cuentas bancarias, tarjetas y medios de pago."
  },
  {
    code: "categories",
    title: "Categorías",
    description: "Categorías y subcategorías para clasificar movimientos."
  },
  {
    code: "classification_rules",
    title: "Reglas automáticas",
    description: "Reglas de clasificación por palabra clave y contexto."
  },
  {
    code: "ai",
    title: "IA",
    description: "Preguntas sugeridas, parámetros e integración de proveedor."
  },
  {
    code: "dashboard",
    title: "Dashboard",
    description: "Widgets visibles, layout y KPIs."
  },
  {
    code: "regional_preferences",
    title: "Preferencias regionales",
    description: "Moneda, formato de fecha e idioma."
  }
];
