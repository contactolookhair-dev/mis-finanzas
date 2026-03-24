"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AuthSessionResponse } from "@/shared/types/auth";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import type { ClassificationRulePayload } from "@/shared/types/classification-rules";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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
    <Card className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Reglas automáticas</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Motor base para sugerir categoría, negocio y origen usando texto y prioridad.
        </p>
      </div>

      {authLoading || loading ? (
        <p className="text-sm text-neutral-500">Cargando reglas...</p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {success ? <p className="text-sm text-success">{success}</p> : null}

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
              financialOrigin: (event.target.value || undefined) as "PERSONAL" | "EMPRESA" | undefined
            }))
          }
        >
          <option value="">Sin origen sugerido</option>
          <option value="PERSONAL">Personal</option>
          <option value="EMPRESA">Empresa</option>
        </Select>
        <label className="flex items-center gap-2 text-sm">
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
        <label className="flex items-center gap-2 text-sm">
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

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-[22px] border border-border bg-white/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{rule.name}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Keyword: {rule.keyword} · Prioridad: {rule.priority} · {rule.matchMode}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {rule.category?.name ?? "Sin categoria"} · {rule.businessUnit?.name ?? "Sin negocio"} ·{" "}
                  {rule.financialOrigin ?? "Sin origen"}
                </p>
              </div>
              {canEdit ? (
                <Button
                  variant="secondary"
                  size="sm"
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
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

