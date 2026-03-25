"use client";

import { useEffect, useMemo, useState } from "react";
import { SETTINGS_SECTIONS, type SettingsSectionCode } from "@/shared/types/settings";
import {
  aiSettingsPayloadSchema,
  appSettingsPayloadSchema,
  dashboardSettingsPayloadSchema,
  userRegionalPreferencesSchema,
  type AISettingsPayload,
  type AppSettingsPayload,
  type DashboardSettingsPayload,
  type UserRegionalPreferences
} from "@/shared/types/settings";
import type { AuthSessionResponse } from "@/shared/types/auth";
import type {
  EditableSettingsSection,
  SectionChangeSummary,
  SettingsAuditLogItem
} from "@/shared/types/settings-admin";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import { computeSectionChanges, formatChangeValue } from "@/shared/utils/settings-diff";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SurfaceCard } from "@/components/ui/surface-card";
import { EmptyStateCard, ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import { StatPill } from "@/components/ui/stat-pill";

type SettingsSnapshot = {
  appSettings: AppSettingsPayload;
  aiSettings: AISettingsPayload;
  dashboardSettings: DashboardSettingsPayload;
  userSettings: UserRegionalPreferences;
};

type SettingsApiResponse = {
  sections: typeof SETTINGS_SECTIONS;
  settings: SettingsSnapshot;
  businessUnits: Array<{ id: string; name: string }>;
};

type SaveResponse = {
  message?: string;
  settings?: SettingsSnapshot;
  changes?: SectionChangeSummary[];
};

function arrayToMultiline(values: string[]) {
  return values.join("\n");
}

function multilineToArray(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeParseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function getSectionTitle(section: EditableSettingsSection) {
  return SETTINGS_SECTIONS.find((item) => item.code === section)?.title ?? section;
}

function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

const textareaClass =
  "min-h-[110px] w-full rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary disabled:bg-neutral-100";

const jsonTextareaClass =
  "min-h-[130px] w-full rounded-2xl border border-white/80 bg-white/85 px-4 py-3 font-mono text-xs outline-none focus:border-primary disabled:bg-neutral-100";

export function SettingsAdminClient() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SettingsSectionCode>("ai");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [businessUnits, setBusinessUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [settings, setSettings] = useState<SettingsSnapshot | null>(null);
  const [baselineSettings, setBaselineSettings] = useState<SettingsSnapshot | null>(null);
  const [savingSection, setSavingSection] = useState<EditableSettingsSection | null>(null);
  const [lastSavedChanges, setLastSavedChanges] = useState<SectionChangeSummary[]>([]);

  const [aiSuggestedQuestionsInput, setAiSuggestedQuestionsInput] = useState("");
  const [aiInsightParametersInput, setAiInsightParametersInput] = useState("{}");
  const [enabledModulesInput, setEnabledModulesInput] = useState("");
  const [dashboardModulesInput, setDashboardModulesInput] = useState("");
  const [visibleWidgetsInput, setVisibleWidgetsInput] = useState("");
  const [layoutConfigInput, setLayoutConfigInput] = useState("{}");
  const [kpiDefinitionsInput, setKpiDefinitionsInput] = useState("{}");

  const [auditLoading, setAuditLoading] = useState(false);
  const [auditItems, setAuditItems] = useState<SettingsAuditLogItem[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);

  const permissions =
    authSession?.authenticated === true && authSession.permissions ? authSession.permissions : null;
  const canViewSettings = Boolean(permissions?.canViewSettings);
  const canViewAuditLog = Boolean(permissions?.canViewAuditLog);
  const canEditSettings = Boolean(permissions?.canEditSettings);
  const canEditAI = Boolean(permissions?.canEditAI);
  const canEditDashboard = Boolean(permissions?.canEditDashboard);
  const canEditModules = Boolean(permissions?.canEditModules);
  const isSaving = useMemo(() => savingSection !== null, [savingSection]);

  const aiInsightParametersParsed = safeParseJsonObject(aiInsightParametersInput);
  const layoutConfigParsed = safeParseJsonObject(layoutConfigInput);
  const kpiDefinitionsParsed = safeParseJsonObject(kpiDefinitionsInput);

  const hasInvalidAiJson = aiInsightParametersParsed === null;
  const hasInvalidDashboardJson = layoutConfigParsed === null || kpiDefinitionsParsed === null;

  function getWorkingSnapshot() {
    if (!settings) return null;

    const appSettingsCandidate = appSettingsPayloadSchema.parse({
      ...settings.appSettings,
      enabledModules: multilineToArray(enabledModulesInput),
      dashboardModules: multilineToArray(dashboardModulesInput)
    });

    const aiSettingsCandidate = aiSettingsPayloadSchema.parse({
      ...settings.aiSettings,
      suggestedQuestions: multilineToArray(aiSuggestedQuestionsInput),
      insightParameters: aiInsightParametersParsed ?? settings.aiSettings.insightParameters
    });

    const dashboardSettingsCandidate = dashboardSettingsPayloadSchema.parse({
      ...settings.dashboardSettings,
      visibleWidgets: multilineToArray(visibleWidgetsInput),
      layoutConfig: layoutConfigParsed ?? settings.dashboardSettings.layoutConfig,
      kpiDefinitions: kpiDefinitionsParsed ?? settings.dashboardSettings.kpiDefinitions
    });

    const userSettingsCandidate = userRegionalPreferencesSchema.parse(settings.userSettings);

    return {
      appSettings: appSettingsCandidate,
      aiSettings: aiSettingsCandidate,
      dashboardSettings: dashboardSettingsCandidate,
      userSettings: userSettingsCandidate
    } satisfies SettingsSnapshot;
  }

  const sectionChanges = useMemo(() => {
    if (!settings || !baselineSettings) return {} as Record<EditableSettingsSection, SectionChangeSummary>;
    const working = getWorkingSnapshot();
    if (!working) return {} as Record<EditableSettingsSection, SectionChangeSummary>;
    return {
      ai: computeSectionChanges("ai", baselineSettings, working),
      general: computeSectionChanges("general", baselineSettings, working),
      dashboard: computeSectionChanges("dashboard", baselineSettings, working),
      regional_preferences: computeSectionChanges("regional_preferences", baselineSettings, working)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings,
    baselineSettings,
    aiSuggestedQuestionsInput,
    aiInsightParametersInput,
    enabledModulesInput,
    dashboardModulesInput,
    visibleWidgetsInput,
    layoutConfigInput,
    kpiDefinitionsInput
  ]);

  const dirtyBySection: Record<EditableSettingsSection, boolean> = {
    ai:
      Boolean(sectionChanges.ai?.changed) ||
      (baselineSettings
        ? aiInsightParametersInput.trim() !==
          JSON.stringify(baselineSettings.aiSettings.insightParameters, null, 2).trim()
        : false),
    general: Boolean(sectionChanges.general?.changed),
    dashboard:
      Boolean(sectionChanges.dashboard?.changed) ||
      (baselineSettings
        ? layoutConfigInput.trim() !== JSON.stringify(baselineSettings.dashboardSettings.layoutConfig, null, 2).trim() ||
          kpiDefinitionsInput.trim() !==
            JSON.stringify(baselineSettings.dashboardSettings.kpiDefinitions, null, 2).trim()
        : false),
    regional_preferences: Boolean(sectionChanges.regional_preferences?.changed)
  };

  const hasDirtyChanges = Object.values(dirtyBySection).some(Boolean);

  useEffect(() => {
    if (!hasDirtyChanges) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasDirtyChanges]);

  async function loadAuth() {
    try {
      setAuthLoading(true);
      const session = await fetchAuthSession();
      setAuthSession(session);
    } catch {
      setAuthSession({ authenticated: false });
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadSettings() {
    if (!canViewSettings) {
      setSettings(null);
      setBaselineSettings(null);
      setBusinessUnits([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/settings", {
        method: "GET"
      });

      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudieron cargar los ajustes.");
      }

      const data = (await res.json()) as SettingsApiResponse;
      setSettings(data.settings);
      setBaselineSettings(data.settings);
      setBusinessUnits(data.businessUnits);
      setAiSuggestedQuestionsInput(arrayToMultiline(data.settings.aiSettings.suggestedQuestions));
      setAiInsightParametersInput(JSON.stringify(data.settings.aiSettings.insightParameters, null, 2));
      setEnabledModulesInput(arrayToMultiline(data.settings.appSettings.enabledModules));
      setDashboardModulesInput(arrayToMultiline(data.settings.appSettings.dashboardModules));
      setVisibleWidgetsInput(arrayToMultiline(data.settings.dashboardSettings.visibleWidgets));
      setLayoutConfigInput(JSON.stringify(data.settings.dashboardSettings.layoutConfig, null, 2));
      setKpiDefinitionsInput(JSON.stringify(data.settings.dashboardSettings.kpiDefinitions, null, 2));
      setLastSavedChanges([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando configuracion.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditLog() {
    if (!canViewAuditLog) {
      setAuditItems([]);
      return;
    }

    try {
      setAuditLoading(true);
      setAuditError(null);
      const response = await fetch("/api/settings/audit?take=20", {
        method: "GET",
        cache: "no-store"
      });
      const payload = (await response.json()) as { message?: string; items?: SettingsAuditLogItem[] };
      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo cargar historial.");
      }
      setAuditItems(payload.items ?? []);
    } catch (historyError) {
      setAuditError(historyError instanceof Error ? historyError.message : "Error en historial.");
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    void loadAuth();
  }, []);

  useEffect(() => {
    if (!authLoading) {
      void loadSettings();
      void loadAuditLog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canViewSettings, canViewAuditLog]);

  async function saveSection(section: EditableSettingsSection) {
    if (!settings || !baselineSettings) return;

    try {
      setSavingSection(section);
      setError(null);
      setSuccess(null);

      const payload: Record<string, unknown> = {};
      if (section === "ai") {
        if (!canEditAI) throw new Error("No tienes permisos para editar la configuracion de IA.");
        if (hasInvalidAiJson) throw new Error("Insight parameters debe ser un JSON valido.");

        payload.aiSettings = aiSettingsPayloadSchema.parse({
          ...settings.aiSettings,
          suggestedQuestions: multilineToArray(aiSuggestedQuestionsInput),
          insightParameters: aiInsightParametersParsed
        });
      }

      if (section === "regional_preferences") {
        if (!canEditSettings) throw new Error("No tienes permisos para editar preferencias regionales.");
        payload.regionalPreferences = userRegionalPreferencesSchema.parse(settings.userSettings);
      }

      if (section === "general") {
        if (!canEditSettings) throw new Error("No tienes permisos para editar configuracion general.");

        payload.appSettings = appSettingsPayloadSchema.parse({
          ...settings.appSettings,
          enabledModules: multilineToArray(enabledModulesInput),
          dashboardModules: multilineToArray(dashboardModulesInput)
        });
      }

      if (section === "dashboard") {
        if (!canEditDashboard) throw new Error("No tienes permisos para editar configuracion del dashboard.");
        if (hasInvalidDashboardJson) throw new Error("Layout/KPI deben ser JSON validos.");

        payload.dashboardSettings = dashboardSettingsPayloadSchema.parse({
          ...settings.dashboardSettings,
          visibleWidgets: multilineToArray(visibleWidgetsInput),
          layoutConfig: layoutConfigParsed,
          kpiDefinitions: kpiDefinitionsParsed
        });
      }

      if (Object.keys(payload).length === 0) {
        throw new Error("No hay cambios para guardar en esta seccion.");
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responsePayload = (await res.json()) as SaveResponse;
      if (!res.ok) {
        throw new Error(responsePayload.message ?? "No se pudo guardar la configuracion.");
      }

      if (responsePayload.settings) {
        setSettings(responsePayload.settings);
        setBaselineSettings(responsePayload.settings);
        setAiSuggestedQuestionsInput(arrayToMultiline(responsePayload.settings.aiSettings.suggestedQuestions));
        setAiInsightParametersInput(JSON.stringify(responsePayload.settings.aiSettings.insightParameters, null, 2));
        setEnabledModulesInput(arrayToMultiline(responsePayload.settings.appSettings.enabledModules));
        setDashboardModulesInput(arrayToMultiline(responsePayload.settings.appSettings.dashboardModules));
        setVisibleWidgetsInput(arrayToMultiline(responsePayload.settings.dashboardSettings.visibleWidgets));
        setLayoutConfigInput(JSON.stringify(responsePayload.settings.dashboardSettings.layoutConfig, null, 2));
        setKpiDefinitionsInput(JSON.stringify(responsePayload.settings.dashboardSettings.kpiDefinitions, null, 2));
      }
      setLastSavedChanges(responsePayload.changes ?? []);
      setSuccess(responsePayload.message ?? "Configuracion guardada.");
      await loadAuditLog();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error guardando configuracion.");
    } finally {
      setSavingSection(null);
    }
  }

  if (authLoading || loading) {
    return <SkeletonCard lines={4} />;
  }

  if (authSession?.authenticated !== true) {
    return (
      <EmptyStateCard
        title="Sesión no iniciada"
        description="Para administrar configuraciones avanzadas necesitas iniciar sesión."
      />
    );
  }

  if (!canViewSettings) {
    return (
      <ErrorStateCard
        title="Sin permisos"
        description="Tu rol actual no tiene permisos para ver o editar la configuración."
      />
    );
  }

  if (!settings || !baselineSettings) {
    return (
      <ErrorStateCard
        title="No fue posible cargar la configuración"
        description="Intenta nuevamente. Si persiste, revisa permisos o conexión."
        onRetry={() => void loadSettings()}
      />
    );
  }

  const activeEditableSection = ["ai", "general", "dashboard", "regional_preferences"].includes(activeSection)
    ? (activeSection as EditableSettingsSection)
    : "ai";
  const currentSummary = sectionChanges[activeEditableSection];
  const sectionIsDirty = dirtyBySection[activeEditableSection];
  const sectionHasValidationError =
    (activeEditableSection === "ai" && hasInvalidAiJson) ||
    (activeEditableSection === "dashboard" && hasInvalidDashboardJson);

  return (
    <div className="space-y-4">
      <SurfaceCard variant="highlight" className="space-y-4">
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Sesion activa</p>
            <p className="mt-1 text-sm font-medium">
              {authSession.user.displayName ?? authSession.user.userKey}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Workspace activo</p>
            <p className="mt-1 text-sm font-medium">
              {authSession.activeWorkspace?.workspaceName ?? "Sin workspace"}
            </p>
            <div className="flex flex-wrap gap-2">
              <StatPill tone="neutral">Rol: {authSession.activeWorkspace?.role ?? "-"}</StatPill>
              <StatPill tone={hasDirtyChanges ? "warning" : "success"}>
                {hasDirtyChanges ? "Cambios sin guardar" : "Todo guardado"}
              </StatPill>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {authSession.memberships.map((membership) => (
            <button
              key={membership.workspaceId}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                authSession.activeWorkspace?.workspaceId === membership.workspaceId
                  ? "border-violet-200 bg-violet-50 text-violet-700 shadow-[0_12px_24px_rgba(124,58,237,0.12)]"
                  : "border-white/80 bg-white/90 text-neutral-600 hover:bg-white"
              }`}
              onClick={async () => {
                if (hasDirtyChanges) {
                  const allow = window.confirm(
                    "Tienes cambios sin guardar. ¿Quieres cambiar de workspace igualmente?"
                  );
                  if (!allow) return;
                }

                try {
                  setError(null);
                  setSuccess(null);
                  const response = await fetch("/api/auth/workspace", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ workspaceId: membership.workspaceId })
                  });
                  const payload = (await response.json()) as { message?: string };
                  if (!response.ok) throw new Error(payload.message ?? "No se pudo cambiar workspace.");
                  await loadAuth();
                  await loadSettings();
                  await loadAuditLog();
                  setSuccess(payload.message ?? "Workspace actualizado.");
                } catch (changeError) {
                  setError(
                    changeError instanceof Error ? changeError.message : "No se pudo cambiar workspace."
                  );
                }
              }}
            >
              {membership.workspaceName}
            </button>
          ))}
        </div>
        <Button variant="secondary" className="rounded-full" onClick={loadSettings} disabled={isSaving}>
          Recargar settings
        </Button>
        {error ? (
          <SurfaceCard variant="soft" padding="sm" className="border-rose-200/80 bg-rose-50/80 text-rose-700">
            <p className="text-sm font-medium">{error}</p>
          </SurfaceCard>
        ) : null}
        {success ? (
          <SurfaceCard
            variant="soft"
            padding="sm"
            className="border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
          >
            <p className="text-sm font-medium">{success}</p>
          </SurfaceCard>
        ) : null}
      </SurfaceCard>

      <SurfaceCard variant="soft" className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {SETTINGS_SECTIONS.filter((section) =>
            ["ai", "regional_preferences", "general", "dashboard"].includes(section.code)
          ).map((section) => {
            const editableCode = section.code as EditableSettingsSection;
            const isDirty = dirtyBySection[editableCode];
            return (
              <button
                key={section.code}
                onClick={() => setActiveSection(section.code)}
                className={`rounded-[24px] border px-4 py-3 text-left transition ${
                  activeSection === section.code
                    ? "border-violet-200 bg-violet-50/90 text-violet-700 shadow-[0_14px_28px_rgba(124,58,237,0.12)]"
                    : "border-white/80 bg-white/80 text-slate-700 hover:bg-white"
                }`}
              >
                <p className="text-sm font-semibold">{section.title}</p>
                <p className="mt-1 text-xs text-neutral-500">{section.description}</p>
                {isDirty ? (
                  <p className="mt-2 text-xs font-semibold text-amber-600">Modificado</p>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-slate-400">Sin cambios</p>
                )}
              </button>
            );
          })}
        </div>
      </SurfaceCard>
      {currentSummary?.changed ? (
        <SurfaceCard variant="soft" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Cambios detectados en {getSectionTitle(activeEditableSection)}</h3>
            <span className="text-xs text-neutral-500">{currentSummary.changes.length} campos</span>
          </div>
          <div className="space-y-2">
            {currentSummary.changes.slice(0, 8).map((change) => (
              <div
                key={`${change.fieldPath}-${String(change.nextValue)}`}
                className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3 text-xs shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
              >
                <p className="font-semibold text-neutral-700">{change.fieldPath}</p>
                <p className="text-neutral-500">Antes: {formatChangeValue(change.previousValue)}</p>
                <p className="text-neutral-700">Ahora: {formatChangeValue(change.nextValue)}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {lastSavedChanges.length > 0 ? (
        <SurfaceCard variant="soft" className="space-y-3">
          <h3 className="text-sm font-semibold">Ultimo guardado</h3>
          {lastSavedChanges.map((sectionSummary) => (
            <div
              key={sectionSummary.section}
              className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3 text-xs shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
            >
              <p className="font-semibold">{getSectionTitle(sectionSummary.section)}</p>
              <p className="text-neutral-500">{sectionSummary.changes.length} cambios aplicados</p>
            </div>
          ))}
        </SurfaceCard>
      ) : null}

      {activeSection === "ai" ? (
        <SurfaceCard variant="soft" className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatPill tone="premium">IA</StatPill>
              <StatPill tone={sectionIsDirty ? "warning" : "neutral"}>
                {sectionIsDirty ? "Pendiente de guardar" : "Estable"}
              </StatPill>
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Configuracion IA</h3>
          </div>
          {!canEditAI ? <p className="text-sm text-neutral-500">Tu rol tiene solo lectura en esta seccion.</p> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Model provider</span>
              <Input
                value={settings.aiSettings.modelProvider}
                disabled={!canEditAI}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev ? { ...prev, aiSettings: { ...prev.aiSettings, modelProvider: event.target.value } } : prev
                  )
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Model name</span>
              <Input
                value={settings.aiSettings.modelName}
                disabled={!canEditAI}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev ? { ...prev, aiSettings: { ...prev.aiSettings, modelName: event.target.value } } : prev
                  )
                }
              />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              disabled={!canEditAI}
              checked={settings.aiSettings.isEnabled}
              onChange={(event) =>
                setSettings((prev) =>
                  prev ? { ...prev, aiSettings: { ...prev.aiSettings, isEnabled: event.target.checked } } : prev
                )
              }
            />
            IA habilitada
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">System prompt</span>
            <textarea
              className={textareaClass}
              value={settings.aiSettings.systemPrompt ?? ""}
              disabled={!canEditAI}
              onChange={(event) =>
                setSettings((prev) =>
                  prev ? { ...prev, aiSettings: { ...prev.aiSettings, systemPrompt: event.target.value } } : prev
                )
              }
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Response tone</span>
              <Input
                value={settings.aiSettings.responseTone}
                disabled={!canEditAI}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev ? { ...prev, aiSettings: { ...prev.aiSettings, responseTone: event.target.value } } : prev
                  )
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Response detail level</span>
              <Select
                value={settings.aiSettings.responseDetailLevel}
                disabled={!canEditAI}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          aiSettings: {
                            ...prev.aiSettings,
                            responseDetailLevel: event.target.value as "breve" | "medio" | "detallado"
                          }
                        }
                      : prev
                  )
                }
              >
                <option value="breve">breve</option>
                <option value="medio">medio</option>
                <option value="detallado">detallado</option>
              </Select>
            </label>
          </div>
          <label className="space-y-2">
            <span className="text-sm font-medium">Suggested questions (1 por linea)</span>
            <textarea
              className={textareaClass}
              value={aiSuggestedQuestionsInput}
              disabled={!canEditAI}
              onChange={(event) => setAiSuggestedQuestionsInput(event.target.value)}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Insight parameters (JSON)</span>
            <textarea
              className={jsonTextareaClass}
              value={aiInsightParametersInput}
              disabled={!canEditAI}
              onChange={(event) => setAiInsightParametersInput(event.target.value)}
            />
            {hasInvalidAiJson ? <p className="text-xs text-danger">JSON invalido.</p> : null}
          </label>
          <Button
            onClick={() => saveSection("ai")}
            disabled={savingSection === "ai" || !canEditAI || !dirtyBySection.ai || hasInvalidAiJson}
          >
            {savingSection === "ai" ? "Guardando IA..." : "Guardar IA"}
          </Button>
        </SurfaceCard>
      ) : null}

      {activeSection === "regional_preferences" ? (
        <SurfaceCard variant="soft" className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatPill tone="premium">Regional</StatPill>
              <StatPill tone={sectionIsDirty ? "warning" : "neutral"}>
                {sectionIsDirty ? "Pendiente de guardar" : "Sin cambios"}
              </StatPill>
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Preferencias regionales</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Language</span>
              <Input
                value={settings.userSettings.language}
                disabled={!canEditSettings}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev ? { ...prev, userSettings: { ...prev.userSettings, language: event.target.value } } : prev
                  )
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Locale</span>
              <Input
                value={settings.userSettings.locale}
                disabled={!canEditSettings}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev ? { ...prev, userSettings: { ...prev.userSettings, locale: event.target.value } } : prev
                  )
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Currency code</span>
              <Input
                value={settings.userSettings.currencyCode}
                disabled={!canEditSettings}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev
                      ? { ...prev, userSettings: { ...prev.userSettings, currencyCode: event.target.value } }
                      : prev
                  )
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Currency symbol</span>
              <Input
                value={settings.userSettings.currencySymbol}
                disabled={!canEditSettings}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev
                      ? { ...prev, userSettings: { ...prev.userSettings, currencySymbol: event.target.value } }
                      : prev
                  )
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Date format</span>
              <Input
                value={settings.userSettings.dateFormat}
                disabled={!canEditSettings}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev ? { ...prev, userSettings: { ...prev.userSettings, dateFormat: event.target.value } } : prev
                  )
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Default business unit</span>
              <Select
                value={settings.userSettings.defaultBusinessUnitId ?? ""}
                disabled={!canEditSettings}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          userSettings: {
                            ...prev.userSettings,
                            defaultBusinessUnitId: event.target.value || undefined
                          }
                        }
                      : prev
                  )
                }
              >
                <option value="">Sin default</option>
                {businessUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <Button
            onClick={() => saveSection("regional_preferences")}
            disabled={
              savingSection === "regional_preferences" || !canEditSettings || !dirtyBySection.regional_preferences
            }
          >
            {savingSection === "regional_preferences" ? "Guardando..." : "Guardar preferencias regionales"}
          </Button>
        </SurfaceCard>
      ) : null}

      {activeSection === "general" || activeSection === "dashboard" ? (
        <SurfaceCard variant="soft" className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatPill tone="premium">
                {activeSection === "general" ? "General" : "Dashboard"}
              </StatPill>
              <StatPill tone={sectionIsDirty ? "warning" : "neutral"}>
                {sectionIsDirty ? "Pendiente de guardar" : "Sin cambios"}
              </StatPill>
            </div>
            <h3 className="text-lg font-semibold tracking-tight">General y Dashboard</h3>
          </div>
          <label className="space-y-2">
            <span className="text-sm font-medium">Enabled modules (1 por linea)</span>
            <textarea
              className={textareaClass}
              value={enabledModulesInput}
              disabled={!canEditModules || activeSection !== "general"}
              onChange={(event) => setEnabledModulesInput(event.target.value)}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Dashboard modules (1 por linea)</span>
            <textarea
              className={textareaClass}
              value={dashboardModulesInput}
              disabled={!canEditSettings || activeSection !== "general"}
              onChange={(event) => setDashboardModulesInput(event.target.value)}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Visible widgets (1 por linea)</span>
              <textarea
                className={textareaClass}
                value={visibleWidgetsInput}
                disabled={!canEditDashboard || activeSection !== "dashboard"}
                onChange={(event) => setVisibleWidgetsInput(event.target.value)}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Default date range days</span>
              <Input
                type="number"
                value={settings.dashboardSettings.defaultDateRangeDays}
                disabled={!canEditDashboard || activeSection !== "dashboard"}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          dashboardSettings: {
                            ...prev.dashboardSettings,
                            defaultDateRangeDays: Number(event.target.value)
                          }
                        }
                      : prev
                  )
                }
              />
            </label>
          </div>
          <label className="space-y-2">
            <span className="text-sm font-medium">Layout config (JSON)</span>
            <textarea
              className={jsonTextareaClass}
              value={layoutConfigInput}
              disabled={!canEditDashboard || activeSection !== "dashboard"}
              onChange={(event) => setLayoutConfigInput(event.target.value)}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">KPI definitions (JSON)</span>
            <textarea
              className={jsonTextareaClass}
              value={kpiDefinitionsInput}
              disabled={!canEditDashboard || activeSection !== "dashboard"}
              onChange={(event) => setKpiDefinitionsInput(event.target.value)}
            />
            {activeSection === "dashboard" && hasInvalidDashboardJson ? (
              <p className="text-xs text-danger">JSON invalido en Layout o KPI definitions.</p>
            ) : null}
          </label>
          <Button
            onClick={() => saveSection(activeSection as EditableSettingsSection)}
            disabled={
              activeSection === "general"
                ? savingSection === "general" || !canEditSettings || !dirtyBySection.general
                : savingSection === "dashboard" ||
                  !canEditDashboard ||
                  !dirtyBySection.dashboard ||
                  hasInvalidDashboardJson
            }
          >
            {savingSection === activeSection ? "Guardando..." : "Guardar seccion"}
          </Button>
        </SurfaceCard>
      ) : null}

      {canViewAuditLog ? (
        <SurfaceCard variant="soft" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Historial de cambios</h3>
            <Button variant="secondary" className="rounded-full" onClick={loadAuditLog} disabled={auditLoading}>
              {auditLoading ? "Actualizando..." : "Actualizar"}
            </Button>
          </div>
          {auditError ? (
            <div className="rounded-[18px] border border-rose-200 bg-rose-50/70 px-3 py-3 text-sm text-rose-700">
              {auditError}
            </div>
          ) : null}
          {auditItems.length === 0 && !auditLoading ? (
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-600">
              Aún no hay cambios registrados.
            </div>
          ) : null}
          <div className="space-y-2">
            {auditItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3 text-sm shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
              >
                <p className="font-semibold">{getSectionTitle(item.section)}</p>
                <p className="text-xs text-neutral-500">
                  {item.userKey} · {formatAuditDate(item.createdAt)}
                </p>
                <p className="mt-1 text-xs text-neutral-600">{item.changedFields.length} campos modificados</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {sectionHasValidationError ? (
        <SurfaceCard variant="soft" padding="sm" className="border-rose-200/80 bg-rose-50/80 text-rose-700">
          <p className="text-xs font-medium">
            Corrige los campos JSON invalidos para habilitar el guardado de la seccion actual.
          </p>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
