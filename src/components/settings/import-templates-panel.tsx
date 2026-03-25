"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { AuthSessionResponse } from "@/shared/types/auth";
import type {
  ImportTemplate,
  ImportTemplateColumns,
  ImportTemplatePayload
} from "@/shared/types/import-templates";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SurfaceCard } from "@/components/ui/surface-card";
import { EmptyStateCard, ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import { StatPill } from "@/components/ui/stat-pill";

type TemplatesResponse = {
  items: ImportTemplate[];
};

const emptyColumns: ImportTemplateColumns = {
  date: [],
  description: [],
  amount: [],
  debit: [],
  credit: [],
  balance: [],
  sourceAccountName: [],
  type: []
};

const emptyTemplate: ImportTemplatePayload = {
  name: "",
  institution: "",
  parser: "csv",
  detectionPriority: 50,
  filenameHints: [],
  headerHints: [],
  columns: emptyColumns,
  amountMode: "SIGNED",
  dateFormats: ["dd/MM/yyyy"],
  hasBalance: true,
  isActive: true,
  notes: null
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

function payloadFromTemplate(template: ImportTemplate): ImportTemplatePayload {
  return {
    name: template.name,
    institution: template.institution,
    parser: template.parser,
    detectionPriority: template.detectionPriority,
    filenameHints: template.filenameHints,
    headerHints: template.headerHints,
    columns: template.columns,
    amountMode: template.amountMode,
    dateFormats: template.dateFormats,
    hasBalance: template.hasBalance,
    isActive: template.isActive,
    notes: template.notes ?? null
  };
}

function SourceBadge({ template }: { template: ImportTemplate }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        template.sourceType === "workspace"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-sky-200 bg-sky-50 text-sky-700"
      }`}
    >
      {template.sourceType === "workspace" ? "Workspace" : "Sistema"}
    </span>
  );
}

export function ImportTemplatesPanel() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [draft, setDraft] = useState<ImportTemplatePayload>(emptyTemplate);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canEdit =
    authSession?.authenticated === true && authSession.permissions
      ? authSession.permissions.canEditSettings
      : false;

  const filenameHintsInput = useMemo(() => arrayToMultiline(draft.filenameHints), [draft.filenameHints]);
  const headerHintsInput = useMemo(() => arrayToMultiline(draft.headerHints), [draft.headerHints]);
  const dateFormatsInput = useMemo(() => arrayToMultiline(draft.dateFormats), [draft.dateFormats]);

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

  async function loadTemplates() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/import-templates", {
        method: "GET",
        cache: "no-store"
      });
      const payload = (await response.json()) as TemplatesResponse & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudieron cargar las plantillas.");
      }
      setTemplates(payload.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando plantillas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSession();
    void loadTemplates();
  }, []);

  function setColumn(field: keyof ImportTemplateColumns, value: string) {
    setDraft((current) => ({
      ...current,
      columns: {
        ...current.columns,
        [field]: multilineToArray(value)
      }
    }));
  }

  async function saveTemplate() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        editingId ? `/api/import-templates/${editingId}` : "/api/import-templates",
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
        throw new Error(payload.message ?? "No se pudo guardar la plantilla.");
      }

      setDraft(emptyTemplate);
      setEditingId(null);
      setSuccess(payload.message ?? "Plantilla guardada.");
      await loadTemplates();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error guardando plantilla.");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateTemplate(templateId: string) {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/import-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ duplicateFromTemplateId: templateId })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo duplicar la plantilla.");
      }

      setSuccess(payload.message ?? "Plantilla duplicada.");
      await loadTemplates();
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Error duplicando plantilla.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(templateId: string) {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/import-templates/${templateId}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo eliminar la plantilla.");
      }

      if (editingId === templateId) {
        setEditingId(null);
        setDraft(emptyTemplate);
      }
      setSuccess(payload.message ?? "Plantilla eliminada.");
      await loadTemplates();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error eliminando plantilla.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTemplate(template: ImportTemplate) {
    if (template.sourceType !== "workspace") return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/import-templates/${template.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...payloadFromTemplate(template),
          isActive: !template.isActive
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo actualizar el estado.");
      }

      setSuccess(payload.message ?? "Estado actualizado.");
      await loadTemplates();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Error actualizando plantilla.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SurfaceCard variant="highlight" className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatPill tone="premium">Importador</StatPill>
            <StatPill tone={canEdit ? "success" : "neutral"}>
              {canEdit ? "Workspace editable" : "Solo lectura"}
            </StatPill>
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-950">
              Plantillas de importación
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">
              Administra mappings por workspace para adaptar cartolas reales sin tocar código.
              Las plantillas personalizadas se prueban antes que las del sistema.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          className="rounded-full"
          disabled={!canEdit}
          onClick={() => {
            setEditingId(null);
            setDraft(emptyTemplate);
            setSuccess(null);
            setError(null);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva plantilla
        </Button>
      </div>

      {authLoading || loading ? <SkeletonCard lines={3} /> : null}
      {error ? (
        <ErrorStateCard
          title="No se pudieron cargar las plantillas"
          description={error}
          onRetry={() => void loadTemplates()}
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

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr]">
        <div className="space-y-3">
          {!loading && templates.length === 0 ? (
            <EmptyStateCard
              title="Sin plantillas todavía"
              description="Crea una plantilla para que el importador reconozca mejor tus cartolas."
            />
          ) : null}
          {templates.map((template) => (
            <SurfaceCard key={template.id} variant="soft" padding="sm" className="space-y-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-neutral-900">{template.name}</p>
                  <SourceBadge template={template} />
                  <StatPill tone="neutral">{template.parser.toUpperCase()}</StatPill>
                  {!template.isActive ? <StatPill tone="warning">Inactiva</StatPill> : null}
                </div>
                <p className="text-sm text-neutral-500">
                  {template.institution} · prioridad {template.detectionPriority}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {template.sourceType === "workspace" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    disabled={!canEdit || saving}
                    onClick={() => {
                      setEditingId(template.id);
                      setDraft(payloadFromTemplate(template));
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  disabled={!canEdit || saving}
                  onClick={() => duplicateTemplate(template.id)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicar
                </Button>
                {template.sourceType === "workspace" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    disabled={!canEdit || saving}
                    onClick={() => toggleTemplate(template)}
                  >
                    {template.isActive ? "Desactivar" : "Activar"}
                  </Button>
                ) : null}
                {template.sourceType === "workspace" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-danger hover:text-danger"
                    disabled={!canEdit || saving}
                    onClick={() => deleteTemplate(template.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </Button>
                ) : null}
              </div>
            </SurfaceCard>
          ))}
        </div>

        <SurfaceCard variant="soft" className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
              {editingId ? "Edición personalizada" : "Nueva plantilla"}
            </p>
            <h4 className="text-lg font-semibold tracking-tight text-slate-950">
              {editingId ? "Editar plantilla del workspace" : "Crear plantilla personalizada"}
            </h4>
            <p className="text-sm text-neutral-500">
              Ajusta columnas, formatos y heurísticas de importación para tus cartolas reales.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Nombre de la plantilla"
              value={draft.name}
              disabled={!canEdit}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            />
            <Input
              placeholder="Banco o institución"
              value={draft.institution}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft((current) => ({ ...current, institution: event.target.value }))
              }
            />
            <Select
              value={draft.parser}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  parser: event.target.value as ImportTemplatePayload["parser"]
                }))
              }
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="pdf">PDF</option>
            </Select>
            <Input
              type="number"
              placeholder="Prioridad"
              value={draft.detectionPriority}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  detectionPriority: Number(event.target.value || 0)
                }))
              }
            />
            <Select
              value={draft.amountMode}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  amountMode: event.target.value as ImportTemplatePayload["amountMode"]
                }))
              }
            >
              <option value="SIGNED">Monto con signo</option>
              <option value="SEPARATE_DEBIT_CREDIT">Cargo / abono separados</option>
            </Select>
            <label className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm text-neutral-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <input
                type="checkbox"
                checked={draft.hasBalance}
                disabled={!canEdit}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, hasBalance: event.target.checked }))
                }
              />
              Incluye saldo
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm text-neutral-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:col-span-2">
              <input
                type="checkbox"
                checked={draft.isActive}
                disabled={!canEdit}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
              Plantilla activa
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <textarea
              className="min-h-28 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400"
              placeholder={"Sugerencias por nombre de archivo\nbanco chile\ncartola"}
              value={filenameHintsInput}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  filenameHints: multilineToArray(event.target.value)
                }))
              }
            />
            <textarea
              className="min-h-28 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400"
              placeholder={"Encabezados esperados\nfecha\nglosa\nsaldo"}
              value={headerHintsInput}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  headerHints: multilineToArray(event.target.value)
                }))
              }
            />
            <textarea
              className="min-h-28 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400"
              placeholder={"Formatos de fecha\ndd/MM/yyyy\nyyyy-MM-dd"}
              value={dateFormatsInput}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dateFormats: multilineToArray(event.target.value)
                }))
              }
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-neutral-700">Equivalencias de columnas</p>
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  ["date", "Fecha"],
                  ["description", "Descripción / glosa"],
                  ["amount", "Monto"],
                  ["debit", "Cargo / débito"],
                  ["credit", "Abono / crédito"],
                  ["balance", "Saldo"],
                  ["sourceAccountName", "Cuenta / producto"],
                  ["type", "Tipo"]
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    {label}
                  </span>
                  <textarea
                    className="min-h-24 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400"
                    placeholder={`${label}\nUna variante por línea`}
                    value={arrayToMultiline(draft.columns[key])}
                    disabled={!canEdit}
                    onChange={(event) => setColumn(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>

          <textarea
            className="min-h-24 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400"
            placeholder="Notas operativas u observaciones de esta plantilla"
            value={draft.notes ?? ""}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                notes: event.target.value.trim() ? event.target.value : null
              }))
            }
          />

          <div className="flex flex-wrap gap-3">
            <Button onClick={saveTemplate} disabled={!canEdit || saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando
                </>
              ) : editingId ? (
                "Actualizar plantilla"
              ) : (
                "Crear plantilla"
              )}
            </Button>
            {editingId ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyTemplate);
                }}
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </SurfaceCard>
      </div>
    </SurfaceCard>
  );
}
