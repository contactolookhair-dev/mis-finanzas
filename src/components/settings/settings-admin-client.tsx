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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

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
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoLoadingAction, setDemoLoadingAction] = useState<"seed" | "clear" | "reset" | null>(null);

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

  async function handleDemoAction(action: "seed" | "clear" | "reset") {
    if (action === "clear") {
      const confirm = window.confirm("Vas a borrar los datos de prueba. ¿Deseas continuar?");
      if (!confirm) return;
    }

    setDemoLoading(true);
    setDemoLoadingAction(action);
    setDemoError(null);
    setDemoMessage(null);

    try {
      const response = await fetch(`/api/demo/${action}`, {
        method: action === "clear" ? "DELETE" : "POST",
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error((payload.message as string) ?? "No se pudo ejecutar la acción demo.");
      }
      let details = "";
      if (payload.summary) {
        const summary = payload.summary as {
          accounts?: number;
          transactions?: number;
          debts?: number;
          debtPayments?: number;
          categories?: number;
        };
        details = `Cuentas ${summary.accounts ?? 0} · Movimientos ${summary.transactions ?? 0} · Deudas ${summary.debts ?? 0}`;
      } else if (payload.result) {
        const result = payload.result as { deletedEntities?: number };
        details = `Entidades eliminadas: ${result.deletedEntities ?? 0}`;
      }
      setDemoMessage(((payload.message as string) ?? "Operación demo completada.") + (details ? ` · ${details}` : ""));
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Error ejecutando operación demo.");
    } finally {
      setDemoLoading(false);
      setDemoLoadingAction(null);
    }
  }

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
    return (
      <Card className="space-y-3">
        <p className="text-sm text-neutral-500">Cargando sesion y configuracion...</p>
      </Card>
    );
  }

  if (authSession?.authenticated !== true) {
    return (
      <Card className="space-y-3">
        <p className="text-sm text-danger">Debes iniciar sesion para administrar configuracion.</p>
      </Card>
    );
  }

  if (!canViewSettings) {
    return (
      <Card className="space-y-3">
        <p className="text-sm text-danger">Tu rol no tiene permisos para ver configuracion.</p>
      </Card>
    );
  }

  if (!settings || !baselineSettings) {
    return (
      <Card className="space-y-3">
        <p className="text-sm text-danger">No fue posible cargar configuracion.</p>
        <Button onClick={loadSettings}>Reintentar</Button>
      </Card>
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
      <Card className="space-y-4">
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Sesion activa</p>
            <p className="mt-1 text-sm font-medium">
              {authSession.user.displayName ?? authSession.user.userKey}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Workspace activo</p>
            <p className="mt-1 text-sm font-medium">
              {authSession.activeWorkspace?.workspaceName ?? "Sin workspace"}
            </p>
            <p className="text-xs text-neutral-500">Rol: {authSession.activeWorkspace?.role ?? "-"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {authSession.memberships.map((membership) => (
            <button
              key={membership.workspaceId}
              className={`rounded-xl border px-3 py-1 text-xs ${
                authSession.activeWorkspace?.workspaceId === membership.workspaceId
                  ? "border-primary bg-accent text-primary"
                  : "border-border bg-white/90 text-neutral-600"
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
        <Button variant="secondary" onClick={loadSettings} disabled={isSaving}>
          Recargar settings
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {success ? <p className="text-sm text-success">{success}</p> : null}
      </Card>

      <Card className="space-y-4">
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
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  activeSection === section.code
                    ? "border-primary bg-accent text-primary"
                    : "border-border bg-white/80 hover:bg-white"
                }`}
              >
                <p className="text-sm font-semibold">{section.title}</p>
                <p className="mt-1 text-xs text-neutral-500">{section.description}</p>
                {isDirty ? <p className="mt-2 text-xs font-semibold text-amber-600">Modificado</p> : null}
              </button>
            );
          })}
        </div>
      </Card>
      <Card className="space-y-4 rounded-[24px] border border-dashed border-slate-200 bg-white/90 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Modo demo</p>
          </div>
          <p className="text-base font-semibold text-slate-900">Datos de prueba seguros</p>
          <p className="text-sm text-neutral-500">
            Carga registros ficticios, borra todo lo generado o reinicia el conjunto cuando quieras.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={demoLoading}
            onClick={() => void handleDemoAction("seed")}
          >
            {demoLoading && demoLoadingAction === "seed" ? "Cargando datos..." : "Cargar datos de prueba"}
          </Button>
          <Button
            variant="secondary"
            disabled={demoLoading}
            onClick={() => void handleDemoAction("clear")}
          >
            {demoLoading && demoLoadingAction === "clear" ? "Borrando datos..." : "Borrar datos de prueba"}
          </Button>
          <Button
            variant="secondary"
            disabled={demoLoading}
            onClick={() => void handleDemoAction("reset")}
          >
            {demoLoading && demoLoadingAction === "reset" ? "Reiniciando datos..." : "Recargar datos de prueba"}
          </Button>
        </div>
        {demoMessage ? <p className="text-sm text-emerald-600">{demoMessage}</p> : null}
        {demoError ? <p className="text-sm text-rose-600">{demoError}</p> : null}
      </Card>

      {currentSummary?.changed ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Cambios detectados en {getSectionTitle(activeEditableSection)}</h3>
            <span className="text-xs text-neutral-500">{currentSummary.changes.length} campos</span>
          </div>
          <div className="space-y-2">
            {currentSummary.changes.slice(0, 8).map((change) => (
              <div
                key={`${change.fieldPath}-${String(change.nextValue)}`}
                className="rounded-xl border border-border bg-white/80 px-3 py-2 text-xs"
              >
                <p className="font-semibold text-neutral-700">{change.fieldPath}</p>
                <p className="text-neutral-500">Antes: {formatChangeValue(change.previousValue)}</p>
                <p className="text-neutral-700">Ahora: {formatChangeValue(change.nextValue)}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {lastSavedChanges.length > 0 ? (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold">Ultimo guardado</h3>
          {lastSavedChanges.map((sectionSummary) => (
            <div key={sectionSummary.section} className="rounded-xl border border-border bg-white/80 px-3 py-2 text-xs">
              <p className="font-semibold">{getSectionTitle(sectionSummary.section)}</p>
              <p className="text-neutral-500">{sectionSummary.changes.length} cambios aplicados</p>
            </div>
          ))}
        </Card>
      ) : null}

      {activeSection === "ai" ? (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Configuracion IA</h3>
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
              className="min-h-[110px] w-full rounded-2xl border border-border bg-white/90 px-4 py-3 text-sm outline-none focus:border-primary disabled:bg-neutral-100"
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
              className="min-h-[110px] w-full rounded-2xl border border-border bg-white/90 px-4 py-3 text-sm outline-none focus:border-primary disabled:bg-neutral-100"
              value={aiSuggestedQuestionsInput}
              disabled={!canEditAI}
              onChange={(event) => setAiSuggestedQuestionsInput(event.target.value)}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Insight parameters (JSON)</span>
            <textarea
              className="min-h-[130px] w-full rounded-2xl border border-border bg-white/90 px-4 py-3 font-mono text-xs outline-none focus:border-primary disabled:bg-neutral-100"
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
        </Card>
      ) : null}

      {activeSection === "regional_preferences" ? (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Preferencias regionales</h3>
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
        </Card>
      ) : null}

      {activeSection === "general" || activeSection === "dashboard" ? (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">General y Dashboard</h3>
          <label className="space-y-2">
            <span className="text-sm font-medium">Enabled modules (1 por linea)</span>
            <textarea
              className="min-h-[100px] w-full rounded-2xl border border-border bg-white/90 px-4 py-3 text-sm outline-none focus:border-primary disabled:bg-neutral-100"
              value={enabledModulesInput}
              disabled={!canEditModules || activeSection !== "general"}
              onChange={(event) => setEnabledModulesInput(event.target.value)}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Dashboard modules (1 por linea)</span>
            <textarea
              className="min-h-[100px] w-full rounded-2xl border border-border bg-white/90 px-4 py-3 text-sm outline-none focus:border-primary disabled:bg-neutral-100"
              value={dashboardModulesInput}
              disabled={!canEditSettings || activeSection !== "general"}
              onChange={(event) => setDashboardModulesInput(event.target.value)}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Visible widgets (1 por linea)</span>
              <textarea
                className="min-h-[120px] w-full rounded-2xl border border-border bg-white/90 px-4 py-3 text-sm outline-none focus:border-primary disabled:bg-neutral-100"
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
              className="min-h-[130px] w-full rounded-2xl border border-border bg-white/90 px-4 py-3 font-mono text-xs outline-none focus:border-primary disabled:bg-neutral-100"
              value={layoutConfigInput}
              disabled={!canEditDashboard || activeSection !== "dashboard"}
              onChange={(event) => setLayoutConfigInput(event.target.value)}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">KPI definitions (JSON)</span>
            <textarea
              className="min-h-[130px] w-full rounded-2xl border border-border bg-white/90 px-4 py-3 font-mono text-xs outline-none focus:border-primary disabled:bg-neutral-100"
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
        </Card>
      ) : null}

      {canViewAuditLog ? (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Historial de cambios</h3>
            <Button variant="secondary" onClick={loadAuditLog} disabled={auditLoading}>
              {auditLoading ? "Actualizando..." : "Actualizar"}
            </Button>
          </div>
          {auditError ? <p className="text-sm text-danger">{auditError}</p> : null}
          {auditItems.length === 0 && !auditLoading ? (
            <p className="text-sm text-neutral-500">Aun no hay cambios registrados.</p>
          ) : null}
          <div className="space-y-2">
            {auditItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-white/80 px-3 py-3 text-sm">
                <p className="font-semibold">{getSectionTitle(item.section)}</p>
                <p className="text-xs text-neutral-500">
                  {item.userKey} · {formatAuditDate(item.createdAt)}
                </p>
                <p className="mt-1 text-xs text-neutral-600">{item.changedFields.length} campos modificados</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {sectionHasValidationError ? (
        <p className="text-xs text-danger">
          Corrige los campos JSON invalidos para habilitar el guardado de la seccion actual.
        </p>
      ) : null}
    </div>
  );
}
