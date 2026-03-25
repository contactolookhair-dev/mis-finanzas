"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { AuthSessionResponse } from "@/shared/types/auth";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import type { ClassificationRulePayload } from "@/shared/types/classification-rules";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SurfaceCard } from "@/components/ui/surface-card";
import { EmptyStateCard, ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import { StatPill } from "@/components/ui/stat-pill";

type RuleItem = ClassificationRulePayload & {
  id: string;
  category?: { id: string; name: string } | null;
  businessUnit?: { id: string; name: string } | null;
};

type RulesResponse = {
  items: RuleItem[];
  references: {
    categories: Array<{ id: string; name: string }>;
    businessUnits: Array<{ id: string; name: string }>;
  };
};

const emptyRule: ClassificationRulePayload = {
  name: "",
  keyword: "",
  priority: 100,
  matchField: "DESCRIPCION",
  matchMode: "PARTIAL",
  isActive: true
};

export function ClassificationRulesPanel() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [references, setReferences] = useState<RulesResponse["references"]>({
    categories: [],
    businessUnits: []
  });
  const [draft, setDraft] = useState<ClassificationRulePayload>(emptyRule);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canEdit =
    authSession?.authenticated === true && authSession.permissions
      ? authSession.permissions.canEditSettings
      : false;

  async function loadSession() {
    try {
      const session = await fetchAuthSession();
      setAuthSession(session);
    } catch {
      setAuthSession({ authenticated: false });
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadRules() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/classification-rules", {
        method: "GET",
        cache: "no-store"
      });
      const payload = (await response.json()) as RulesResponse & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudieron cargar las reglas.");
      }
      setRules(payload.items);
      setReferences(payload.references);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando reglas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSession();
    void loadRules();
  }, []);

  async function saveRule() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        editingId ? `/api/classification-rules/${editingId}` : "/api/classification-rules",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(draft)
        }
      );
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo guardar la regla.");
      }
      setDraft(emptyRule);
      setEditingId(null);
      setSuccess(payload.message ?? "Regla guardada.");
      await loadRules();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error guardando regla.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SurfaceCard variant="highlight" className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatPill tone="premium" icon={<Sparkles className="h-3.5 w-3.5" />}>
              Automatización
            </StatPill>
            <StatPill tone={canEdit ? "success" : "neutral"}>
              {canEdit ? "Edición habilitada" : "Solo lectura"}
            </StatPill>
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-950">
              Reglas automáticas
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">
              Motor base para sugerir categoría, negocio y origen usando texto y prioridad.
            </p>
          </div>
        </div>
      </div>

      {!canEdit ? (
        <SurfaceCard variant="soft" padding="sm" className="border-dashed">
          <p className="text-sm text-slate-600">
            Tu rol actual puede revisar las reglas existentes, pero no crear ni editar reglas nuevas.
          </p>
        </SurfaceCard>
      ) : null}

      {authLoading || loading ? <SkeletonCard lines={3} /> : null}
      {error ? (
        <ErrorStateCard
          title="No se pudieron cargar las reglas"
          description={error}
          onRetry={() => void loadRules()}
        />
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

      <SurfaceCard variant="soft" className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
            {editingId ? "Editar regla" : "Nueva regla"}
          </p>
          <h4 className="text-base font-semibold tracking-tight text-slate-950">
            {editingId ? "Ajusta la lógica de clasificación" : "Crear sugerencia automática"}
          </h4>
          <p className="text-sm text-neutral-500">
            Define palabras clave y prioridad para reducir el trabajo manual al clasificar movimientos.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input
            placeholder="Nombre de la regla"
            value={draft.name}
            disabled={!canEdit}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            placeholder="Texto o palabra clave"
            value={draft.keyword}
            disabled={!canEdit}
            onChange={(event) => setDraft((current) => ({ ...current, keyword: event.target.value }))}
          />
          <Input
            type="number"
            placeholder="Prioridad"
            value={draft.priority}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({ ...current, priority: Number(event.target.value) }))
            }
          />
          <Select
            value={draft.matchMode}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                matchMode: event.target.value as "PARTIAL" | "EXACT"
              }))
            }
          >
            <option value="PARTIAL">Coincidencia parcial</option>
            <option value="EXACT">Coincidencia exacta</option>
          </Select>
          <Select
            value={draft.categoryId ?? ""}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({ ...current, categoryId: event.target.value || undefined }))
            }
          >
            <option value="">Sin categoria sugerida</option>
            {references.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            value={draft.businessUnitId ?? ""}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({ ...current, businessUnitId: event.target.value || undefined }))
            }
          >
            <option value="">Sin negocio sugerido</option>
            {references.businessUnits.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            value={draft.financialOrigin ?? ""}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                financialOrigin: (event.target.value || undefined) as
                  | "PERSONAL"
                  | "EMPRESA"
                  | undefined
              }))
            }
          >
            <option value="">Sin origen sugerido</option>
            <option value="PERSONAL">Personal</option>
            <option value="EMPRESA">Empresa</option>
          </Select>
          <label className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <input
              type="checkbox"
              checked={Boolean(draft.isReimbursable)}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft((current) => ({ ...current, isReimbursable: event.target.checked }))
              }
            />
            Reembolsable
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <input
              type="checkbox"
              checked={draft.isActive}
              disabled={!canEdit}
              onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Activa
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={saveRule} disabled={!canEdit || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando
              </>
            ) : editingId ? (
              "Actualizar regla"
            ) : (
              "Crear regla"
            )}
          </Button>
          {editingId ? (
            <Button
              variant="secondary"
              onClick={() => {
                setEditingId(null);
                setDraft(emptyRule);
              }}
            >
              Cancelar
            </Button>
          ) : null}
        </div>
      </SurfaceCard>

      <div className="space-y-3">
        {!loading && rules.length === 0 ? (
          <EmptyStateCard
            title="Sin reglas todavía"
            description="Crea una regla para sugerir categoría, negocio u origen durante la importación y edición."
          />
        ) : null}
        {rules.map((rule) => (
          <SurfaceCard key={rule.id} variant="soft" padding="sm" className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-950">{rule.name}</p>
                  <StatPill tone={rule.isActive ? "success" : "neutral"}>
                    {rule.isActive ? "Activa" : "Inactiva"}
                  </StatPill>
                  <StatPill tone="premium">Prioridad {rule.priority}</StatPill>
                </div>
                <p className="text-xs text-neutral-500">
                  Keyword: {rule.keyword} ·{" "}
                  {rule.matchMode === "EXACT" ? "Coincidencia exacta" : "Coincidencia parcial"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <StatPill tone="neutral">{rule.category?.name ?? "Sin categoría"}</StatPill>
                  <StatPill tone="neutral">{rule.businessUnit?.name ?? "Sin negocio"}</StatPill>
                  <StatPill tone="neutral">{rule.financialOrigin ?? "Sin origen"}</StatPill>
                  {rule.isReimbursable ? <StatPill tone="warning">Reembolsable</StatPill> : null}
                </div>
              </div>
              {canEdit ? (
                <ActionButton
                  icon={Sparkles}
                  tone="neutral"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    setEditingId(rule.id);
                    setDraft({
                      name: rule.name,
                      keyword: rule.keyword,
                      priority: rule.priority,
                      matchField: rule.matchField,
                      matchMode: rule.matchMode,
                      categoryId: rule.categoryId ?? undefined,
                      businessUnitId: rule.businessUnitId ?? undefined,
                      financialOrigin: rule.financialOrigin ?? undefined,
                      isReimbursable: rule.isReimbursable ?? undefined,
                      isActive: rule.isActive
                    });
                  }}
                >
                  Editar
                </ActionButton>
              ) : null}
            </div>
          </SurfaceCard>
        ))}
      </div>
    </SurfaceCard>
  );
}
