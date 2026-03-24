import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  aiSettingsPayloadSchema,
  appSettingsPayloadSchema,
  dashboardSettingsPayloadSchema,
  userRegionalPreferencesSchema,
  SETTINGS_SECTIONS
} from "@/shared/types/settings";
import { getResolvedSettings, updateConfigSettings } from "@/server/services/settings-service";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { listBusinessUnits } from "@/server/repositories/business-unit-repository";
import { hasPermission } from "@/server/permissions/permissions";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { getAuthSessionFromRequest } from "@/server/auth/session";
import { registerSettingsAudit } from "@/server/services/admin-audit-service";
import { computeSectionChanges } from "@/shared/utils/settings-diff";
import type { EditableSettingsSection } from "@/shared/types/settings-admin";

const updateSettingsSchema = z.object({
  appSettings: appSettingsPayloadSchema.optional(),
  aiSettings: aiSettingsPayloadSchema.optional(),
  dashboardSettings: dashboardSettingsPayloadSchema.optional(),
  regionalPreferences: userRegionalPreferencesSchema.optional()
});

function pickSettingsSectionData(
  settings: {
    appSettings: ReturnType<typeof appSettingsPayloadSchema.parse>;
    aiSettings: ReturnType<typeof aiSettingsPayloadSchema.parse>;
    dashboardSettings: ReturnType<typeof dashboardSettingsPayloadSchema.parse>;
    userSettings: ReturnType<typeof userRegionalPreferencesSchema.parse>;
  },
  section: EditableSettingsSection
) {
  switch (section) {
    case "ai":
      return settings.aiSettings as Record<string, unknown>;
    case "general":
      return settings.appSettings as Record<string, unknown>;
    case "dashboard":
      return settings.dashboardSettings as Record<string, unknown>;
    case "regional_preferences":
      return settings.userSettings as Record<string, unknown>;
  }
}

export async function GET(request: NextRequest) {
  const access = await requireRoutePermission(request, "settings:view");
  if (!access.ok) {
    return access.response;
  }
  const context = access.context;

  const [settings, businessUnits] = await Promise.all([
    getResolvedSettings(context.workspaceId, context.userKey),
    listBusinessUnits(context.workspaceId)
  ]);

  return NextResponse.json({
    sections: SETTINGS_SECTIONS,
    settings,
    businessUnits: businessUnits.map((unit) => ({
      id: unit.id,
      name: unit.name
    }))
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getWorkspaceContextFromRequest(request);
    if (!context.workspaceId || !context.userKey || !context.role) {
      return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
    }
    const workspaceId = context.workspaceId;
    const userKey = context.userKey;

    const json = await request.json();
    const payload = updateSettingsSchema.parse(json);
    const authSession = await getAuthSessionFromRequest(request);
    const previousSettings = await getResolvedSettings(workspaceId, userKey);
    const editsAI = Boolean(payload.aiSettings);
    const editsDashboard = Boolean(payload.dashboardSettings);
    const editsGeneral = Boolean(payload.appSettings || payload.regionalPreferences);

    if (editsGeneral && !hasPermission(context.role, "settings:edit")) {
      return NextResponse.json(
        { message: "Sin permisos para editar configuración general." },
        { status: 403 }
      );
    }
    if (editsAI && !hasPermission(context.role, "settings:ai:edit")) {
      return NextResponse.json(
        { message: "Sin permisos para editar configuración de IA." },
        { status: 403 }
      );
    }
    if (editsDashboard && !hasPermission(context.role, "settings:dashboard:edit")) {
      return NextResponse.json(
        { message: "Sin permisos para editar configuración de dashboard." },
        { status: 403 }
      );
    }
    if (payload.appSettings?.enabledModules && !hasPermission(context.role, "settings:modules:edit")) {
      return NextResponse.json(
        { message: "Sin permisos para editar módulos activos." },
        { status: 403 }
      );
    }

    const settings = await updateConfigSettings({
      workspaceId,
      userKey,
      appSettings: payload.appSettings,
      aiSettings: payload.aiSettings,
      dashboardSettings: payload.dashboardSettings,
      regionalPreferences: payload.regionalPreferences
    });
    const previousNormalized = {
      appSettings: appSettingsPayloadSchema.parse(previousSettings.appSettings),
      aiSettings: aiSettingsPayloadSchema.parse(previousSettings.aiSettings),
      dashboardSettings: dashboardSettingsPayloadSchema.parse(previousSettings.dashboardSettings),
      userSettings: userRegionalPreferencesSchema.parse(previousSettings.userSettings)
    };
    const currentNormalized = {
      appSettings: appSettingsPayloadSchema.parse(settings.appSettings),
      aiSettings: aiSettingsPayloadSchema.parse(settings.aiSettings),
      dashboardSettings: dashboardSettingsPayloadSchema.parse(settings.dashboardSettings),
      userSettings: userRegionalPreferencesSchema.parse(settings.userSettings)
    };

    const editedSections: EditableSettingsSection[] = [];
    if (payload.aiSettings) editedSections.push("ai");
    if (payload.appSettings) editedSections.push("general");
    if (payload.dashboardSettings) editedSections.push("dashboard");
    if (payload.regionalPreferences) editedSections.push("regional_preferences");

    const sectionChanges = editedSections
      .map((section) => computeSectionChanges(section, previousNormalized, currentNormalized))
      .filter((change) => change.changed);

    await Promise.all(
      sectionChanges.map((change) =>
        registerSettingsAudit({
          workspaceId,
          userKey,
          sessionId: authSession?.id,
          section: change.section,
          changedFields: change.changes,
          beforeData: pickSettingsSectionData(previousNormalized, change.section),
          afterData: pickSettingsSectionData(currentNormalized, change.section)
        })
      )
    );

    return NextResponse.json({
      message: "Configuración actualizada correctamente.",
      settings,
      changes: sectionChanges
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload de configuración inválido.", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "No se pudo actualizar la configuración." },
      { status: 500 }
    );
  }
}
