"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, FileSpreadsheet, FileUp, Loader2 } from "lucide-react";
import type { AuthSessionResponse } from "@/shared/types/auth";
import type {
  ImportCommitRow,
  ImportFieldSuggestion,
  ImportParserKind,
  ImportPreviewRow,
  ImportParserMeta
} from "@/shared/types/imports";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorStateCard } from "@/components/ui/states";
import { SurfaceCard } from "@/components/ui/surface-card";

type ReferenceOption = { id: string; name: string; type?: string | null; institution?: string | null };

type PreviewResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  debug?: {
    aiUsed?: boolean;
    geminiStatus?: number | null;
    geminiError?: string | null;
    textLength?: number;
    geminiBody?: string;
  };
  parser: ImportParserKind;
  supported: boolean;
  warnings: string[];
  pdfMeta?: unknown;
  pdfAccountSuggestion?: null | {
    mode: "matched" | "missing" | "ambiguous";
    accountId?: string;
    suggestedCreate?: {
      name: string;
      bank: string;
      type: "CREDITO";
      creditLimit?: number | null;
      closingDay?: number | null;
      paymentDay?: number | null;
    };
    candidates?: Array<{ id: string; name: string; institution?: string | null }>;
  };
  appliedTemplate: {
    id: string;
    name: string;
    institution: string;
    sourceType: "system" | "workspace";
    mode: "detected" | "manual" | "generic";
    confidence: number;
  } | null;
  availableTemplates: Array<{
    id: string;
    name: string;
    institution: string;
    sourceType: "system" | "workspace";
    isSystem: boolean;
  }>;
  rows: ImportPreviewRow[];
  summary: {
    totalRows: number;
    readyToImport: number;
    duplicates: number;
    invalid: number;
  };
  references: {
    categories: ReferenceOption[];
    businessUnits: ReferenceOption[];
    accounts: ReferenceOption[];
  };
};

type CommitSummary = {
  imported: number;
  omitted: number;
  duplicates: number;
  errors: Array<{ rowId: string; message: string }>;
};

type InstallmentPreviewFields = {
  descripcionBase?: string;
  esCompraEnCuotas?: boolean;
  cuotaActual?: number | null;
  cuotaTotal?: number | null;
  montoCuota?: number | null;
  montoTotalCompra?: number | null;
  cuotasRestantes?: number | null;
  descriptionBase?: string;
  isInstallmentPurchase?: boolean;
  currentInstallment?: number | null;
  totalInstallments?: number | null;
  installmentAmount?: number | null;
  totalPurchaseAmount?: number | null;
  remainingInstallments?: number | null;
};

function isCreditCardAccount(option?: ReferenceOption | null) {
  return option?.type === "TARJETA_CREDITO";
}

function computeDefaultNextInstallmentDate(baseYmd?: string) {
  const base = baseYmd ? new Date(`${baseYmd}T12:00:00`) : new Date();
  const next = new Date(base);
  next.setMonth(next.getMonth() + 1);
  const year = next.getFullYear();
  const month = `${next.getMonth() + 1}`.padStart(2, "0");
  const day = `${next.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDuplicateLabel(status: ImportPreviewRow["duplicateStatus"]) {
  if (status === "existing") return "Duplicado existente";
  if (status === "batch") return "Duplicado en archivo";
  return null;
}

function getFriendlyPreviewError(message: string) {
  if (
    message.includes("did not match the expected pattern") ||
    message.includes("expected pattern")
  ) {
    return "No pudimos leer este PDF con la configuración actual. Intenta nuevamente o revisa la cuenta seleccionada.";
  }

  return message;
}

function formatCurrencyCLP(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `$${value.toLocaleString("es-CL")}`;
}

function getInstallmentPreview(row: ImportPreviewRow) {
  const data = row as ImportPreviewRow & InstallmentPreviewFields;

  const descriptionBase =
    typeof data.descripcionBase === "string" && data.descripcionBase.trim().length > 0
      ? data.descripcionBase.trim()
      : typeof data.descriptionBase === "string" && data.descriptionBase.trim().length > 0
        ? data.descriptionBase.trim()
        : null;

  const isInstallmentPurchase =
    data.esCompraEnCuotas === true || data.isInstallmentPurchase === true;

  const currentInstallment =
    typeof data.cuotaActual === "number"
      ? data.cuotaActual
      : typeof data.currentInstallment === "number"
        ? data.currentInstallment
        : null;

  const totalInstallments =
    typeof data.cuotaTotal === "number"
      ? data.cuotaTotal
      : typeof data.totalInstallments === "number"
        ? data.totalInstallments
        : null;

  const installmentAmount =
    typeof data.montoCuota === "number"
      ? data.montoCuota
      : typeof data.installmentAmount === "number"
        ? data.installmentAmount
        : null;

  const totalPurchaseAmount =
    typeof data.montoTotalCompra === "number"
      ? data.montoTotalCompra
      : typeof data.totalPurchaseAmount === "number"
        ? data.totalPurchaseAmount
        : null;

  const remainingInstallments =
    typeof data.cuotasRestantes === "number"
      ? data.cuotasRestantes
      : typeof data.remainingInstallments === "number"
        ? data.remainingInstallments
        : null;

  return {
    descriptionBase,
    isInstallmentPurchase,
    currentInstallment,
    totalInstallments,
    installmentAmount,
    totalPurchaseAmount,
    remainingInstallments
  };
}

function normalizePreviewRow(row: ImportPreviewRow): ImportPreviewRow {
  const installment = getInstallmentPreview(row);

  if (!installment.descriptionBase) return row;
  if (row.description === installment.descriptionBase) return row;

  return {
    ...row,
    description: installment.descriptionBase
  };
}

function SuggestionBadge({ suggestion }: { suggestion?: ImportFieldSuggestion }) {
  if (!suggestion) return null;

  const tone =
    suggestion.source === "rule"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : suggestion.source === "history"
        ? "bg-slate-100 text-slate-700 border-slate-200"
        : suggestion.source === "manual"
          ? "bg-slate-100 text-slate-700 border-slate-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${tone}`}>
      {suggestion.source === "rule"
        ? "Sugerido por regla"
        : suggestion.source === "history"
          ? "Sugerido por historico"
          : suggestion.source === "manual"
            ? "Ajustado manualmente"
            : suggestion.label}
    </span>
  );
}

export function ImportTransactionsPanel(props: {
  initialLane?: "account" | "credit";
  initialAccountId?: string | null;
}) {
  const { initialLane = "account", initialAccountId = null } = props;
  const [authLoading, setAuthLoading] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);
  const [importLane, setImportLane] = useState<"account" | "credit">(initialLane);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewDebug, setPreviewDebug] = useState<PreviewResponse["debug"] | null>(null);
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [commitSummary, setCommitSummary] = useState<CommitSummary | null>(null);
  const [creatingSuggestedAccount, setCreatingSuggestedAccount] = useState(false);
  const [selectedPdfAccountId, setSelectedPdfAccountId] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rowView, setRowView] = useState<"all" | "normal" | "installments">("all");

  useEffect(() => {
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

    void loadSession();
  }, []);

  useEffect(() => {
    function handler(event: Event) {
      const detail =
        event instanceof CustomEvent && event.detail && typeof event.detail === "object"
          ? (event.detail as { lane?: "account" | "credit" })
          : {};
      if (detail.lane) {
        setImportLane(detail.lane);
      }
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 0);
    }

    window.addEventListener("imports:open-file-picker", handler as EventListener);
    return () => window.removeEventListener("imports:open-file-picker", handler as EventListener);
  }, []);

  const canImport =
    authSession?.authenticated === true && authSession.permissions
      ? authSession.permissions.canImportTransactions
      : false;

  const normalizedRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const aiUsed = useMemo(
    () =>
      normalizedRows.some((row) => {
        const meta = (row as ImportPreviewRow & { parserMeta?: ImportParserMeta }).parserMeta;
        return meta?.kind === "pdf-ai";
      }),
    [normalizedRows]
  );
  const selectedIsPdf = Boolean(
    selectedFile &&
      (selectedFile.type.toLowerCase().includes("pdf") || selectedFile.name.toLowerCase().endsWith(".pdf"))
  );
  const readyToImportCount = useMemo(
    () => normalizedRows.filter((row) => row.include && row.issues.length === 0).length,
    [normalizedRows]
  );

  const accountById = useMemo(() => {
    if (!preview) return new Map<string, ReferenceOption>();
    return new Map(preview.references.accounts.map((account) => [account.id, account]));
  }, [preview]);

  const pdfMeta = useMemo(
    () =>
      preview?.pdfMeta && typeof preview.pdfMeta === "object"
        ? (preview.pdfMeta as Record<string, unknown>)
        : null,
    [preview]
  );

  const pdfSuggestion = preview?.pdfAccountSuggestion ?? null;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    const legacyMq = mq as unknown as {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };
    legacyMq.addListener?.(update);
    return () => legacyMq.removeListener?.(update);
  }, []);

  useEffect(() => {
    if (importLane !== "credit") return;
    if (selectedTemplateId) return;
    if (!preview?.availableTemplates?.length) return;
    const found =
      preview.availableTemplates.find((t) => t.institution.toLowerCase().includes("falabella")) ??
      preview.availableTemplates.find((t) => t.name.toLowerCase().includes("cmr"));
    if (found) setSelectedTemplateId(found.id);
  }, [importLane, preview?.availableTemplates, selectedTemplateId]);

  useEffect(() => {
    setImportLane(initialLane);
  }, [initialLane]);

  useEffect(() => {
    if (!initialAccountId) return;
    setSelectedPdfAccountId(initialAccountId);
  }, [initialAccountId]);

  useEffect(() => {
    if (!initialAccountId || importLane !== "credit" || !preview) return;
    const exists = preview.references.accounts.some((account) => account.id === initialAccountId);
    if (!exists) return;
    setSelectedPdfAccountId(initialAccountId);
    applyPdfAccountToAllRows(initialAccountId);
  }, [importLane, initialAccountId, preview]);

  const debtorNameOptions = useMemo(() => {
    const names = normalizedRows
      .map((row) => row.debtorName)
      .filter((value): value is string => Boolean(value && value.trim().length >= 3))
      .map((value) => value.trim());
    return Array.from(new Set(names)).slice(0, 50);
  }, [normalizedRows]);

  function updateRow(rowId: string, patch: Partial<ImportPreviewRow>) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;

        const next = { ...row, ...patch };
        const nextIssues = [...next.issues].filter(
          (issue) =>
            ![
              "Fecha no reconocida",
              "Descripcion vacia",
              "Monto no reconocido",
              "Tipo no reconocido"
            ].includes(issue)
        );

        if (!next.date) nextIssues.push("Fecha no reconocida");
        if (!next.description.trim()) nextIssues.push("Descripcion vacia");
        if (typeof next.amount !== "number" || !Number.isFinite(next.amount)) {
          nextIssues.push("Monto no reconocido");
        }
        if (!next.type) nextIssues.push("Tipo no reconocido");

        if (next.classification === "NEGOCIO" && next.type === "EGRESO" && !next.businessUnitId) {
          nextIssues.push("Selecciona unidad de negocio");
        }
        if (next.classification === "PRESTADO" && next.type === "EGRESO") {
          if (!next.debtorName || next.debtorName.trim().length < 3) {
            nextIssues.push("Falta nombre de persona");
          }
          if (next.isInstallmentDebt) {
            if (!next.installmentCount || next.installmentCount < 1) nextIssues.push("Cuotas inválidas");
            if (!next.installmentValue || next.installmentValue < 1) nextIssues.push("Valor cuota inválido");
          }
        }

        return {
          ...next,
          issues: Array.from(new Set(nextIssues))
        };
      })
    );
  }

  function setManualField<K extends keyof NonNullable<ImportPreviewRow["suggestionMeta"]>>(
    row: ImportPreviewRow,
    rowId: string,
    field: K,
    patch: Partial<ImportPreviewRow>
  ) {
    updateRow(rowId, {
      ...patch,
      suggestionMeta: {
        ...row.suggestionMeta,
        [field]: {
          source: "manual",
          label: "Ajustado manualmente"
        }
      }
    });
  }

  async function handlePreview() {
    if (!selectedFile) {
      setError("Selecciona un archivo CSV, Excel o PDF.");
      return;
    }

    try {
      setLoadingPreview(true);
      setError(null);
      setSuccess(null);
      setCommitSummary(null);
      setPreviewDebug(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      if (selectedTemplateId) {
        formData.append("templateId", selectedTemplateId);
      }
      formData.append("type", importLane);

      const contextualAccountId =
        importLane === "credit" ? selectedPdfAccountId || initialAccountId || "" : "";
      if (contextualAccountId) {
        formData.append("accountId", contextualAccountId);
      }

      console.log("import preview payload", {
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
        importLane,
        contextualAccountId,
        selectedTemplateId
      });

      const response = await fetch("/api/imports/preview", {
        method: "POST",
        headers: {
          Accept: "application/json"
        },
        body: formData
      });

      const rawBody = await response.text();
      let payload: PreviewResponse | null = null;
      try {
        payload = rawBody ? (JSON.parse(rawBody) as PreviewResponse) : null;
      } catch (parseError) {
        console.error("import preview non-json response", {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get("content-type"),
          bodyStart: rawBody.slice(0, 120),
          parseError: parseError instanceof Error ? parseError.message : parseError
        });
        throw new Error(
          "No pudimos leer este PDF con la configuración actual. Intenta nuevamente o revisa la cuenta seleccionada."
        );
      }

      const payloadRows = Array.isArray(payload?.rows) ? payload.rows : [];
      const hasRows = payloadRows.length > 0;
      if (payload?.debug) setPreviewDebug(payload.debug);

      // If we have rows, always allow the user to review/edit, even if AI failed.
      if (!payload || !response.ok || (payload.success === false && !hasRows)) {
        throw new Error(
          getFriendlyPreviewError(
            payload?.message ??
              "No pudimos leer este PDF. Verifica el archivo o intenta nuevamente."
          )
        );
      }

      setPreview(payload);
      setSelectedTemplateId(payload.appliedTemplate?.id ?? "");
      setRows(payloadRows.map(normalizePreviewRow));
      setSelectedPdfAccountId(payload.pdfAccountSuggestion?.accountId ?? contextualAccountId ?? "");

      if (payload?.debug?.aiUsed && payload?.debug?.geminiError && hasRows) {
        setSuccess("No pudimos usar IA, pero puedes revisar los movimientos detectados manualmente.");
      }
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? getFriendlyPreviewError(previewError.message)
          : "No pudimos leer este PDF con la configuración actual. Intenta nuevamente o revisa la cuenta seleccionada."
      );
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleCreateSuggestedAccount() {
    if (!preview?.pdfAccountSuggestion?.suggestedCreate) return;
    try {
      setCreatingSuggestedAccount(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: preview.pdfAccountSuggestion.suggestedCreate.name,
          bank: preview.pdfAccountSuggestion.suggestedCreate.bank,
          type: preview.pdfAccountSuggestion.suggestedCreate.type,
          creditLimit: preview.pdfAccountSuggestion.suggestedCreate.creditLimit ?? undefined,
          closingDay: preview.pdfAccountSuggestion.suggestedCreate.closingDay ?? undefined,
          paymentDay: preview.pdfAccountSuggestion.suggestedCreate.paymentDay ?? undefined
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo crear la cuenta sugerida.");
      }

      setSuccess("Cuenta creada. Reinterpretando el PDF...");
      await handlePreview();
    } catch (accountError) {
      setError(
        accountError instanceof Error
          ? accountError.message
          : "No se pudo crear la cuenta sugerida."
      );
    } finally {
      setCreatingSuggestedAccount(false);
    }
  }

  function applyPdfAccountToAllRows(accountId: string) {
    setRows((current) => (Array.isArray(current) ? current : []).map((row) => ({ ...row, accountId })));
  }

  async function handleCommit() {
    if (!preview) return;

    try {
      setCommitting(true);
      setError(null);
      setSuccess(null);
      setCommitSummary(null);

      const payload = {
        parser: preview.parser,
        fileName: selectedFile?.name ?? "importacion",
        appliedTemplateId: preview.appliedTemplate?.id ?? undefined,
        pdfMeta: preview.pdfMeta ?? undefined,
        pdfWarnings: preview.warnings ?? undefined,
        rows: rows.map<ImportCommitRow>((row) => ({
          id: row.id,
          rowNumber: row.rowNumber,
          date: row.date ?? "",
          description: row.description,
          amount: row.amount ?? Number.NaN,
          type: row.type ?? "EGRESO",
          balance: row.balance ?? null,
          sourceAccountName: row.sourceAccountName,
          accountId: row.accountId,
          categoryId: row.categoryId,
          businessUnitId: row.businessUnitId,
          financialOrigin: row.financialOrigin,
          isReimbursable: row.isReimbursable,
          isBusinessPaidPersonally: row.isBusinessPaidPersonally,
          classification: row.classification,
          debtorName: row.debtorName,
          owedAmount: row.owedAmount,
          isInstallmentDebt: row.isInstallmentDebt,
          installmentCount: row.installmentCount,
          installmentValue: row.installmentValue,
          nextInstallmentDate: row.nextInstallmentDate ?? null,
          debtNote: row.debtNote ?? null,
          parserMeta: (row as ImportPreviewRow & { parserMeta?: ImportParserMeta }).parserMeta,
          duplicateFingerprint: row.duplicateFingerprint,
          duplicateStatus: row.duplicateStatus,
          suggestionMeta: row.suggestionMeta,
          issues: row.issues,
          include: row.include
        }))
      };

      const response = await fetch("/api/imports/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as { message?: string; summary?: CommitSummary };

      if (!response.ok) {
        throw new Error(body.message ?? "No se pudo completar la importacion.");
      }

      setSuccess(body.message ?? "Importacion completada.");
      setCommitSummary(body.summary ?? null);
      setRows([]);
      setPreview(null);
      setSelectedFile(null);
    } catch (commitError) {
      setError(
        commitError instanceof Error ? commitError.message : "Error al guardar movimientos."
      );
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-4" id="importar">
      <SurfaceCard variant="soft" padding="sm" className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Importación
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              Vista previa antes de guardar
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Soporta CSV, Excel (.xlsx) y PDF con texto seleccionable.
            </p>
          </div>
          <div className="hidden rounded-2xl border border-slate-200 bg-white/80 p-3 text-slate-700 md:block">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
        </div>

        {authLoading ? <p className="text-sm text-slate-600">Validando permisos...</p> : null}
        {!authLoading && !canImport ? (
          <ErrorStateCard
            title="Permisos insuficientes"
            description="Tu rol actual no tiene permisos para importar movimientos."
            className="shadow-none"
          />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setImportLane("account")}
            className={`tap-feedback rounded-2xl border p-4 text-left shadow-[0_10px_22px_rgba(15,23,42,0.05)] ${importLane === "account"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white/80 text-slate-900"
              }`}
          >
            <p
              className={`text-xs font-semibold uppercase tracking-[0.24em] ${importLane === "account" ? "text-white/80" : "text-slate-500"
                }`}
            >
              Cuenta corriente / Débito
            </p>
            <p className="mt-1 text-base font-semibold">Movimientos de cuenta</p>
            <p className={`mt-1 text-sm ${importLane === "account" ? "text-white/80" : "text-slate-600"}`}>
              Sube PDF/CSV/XLSX de tu cuenta para revisar y guardar movimientos.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setImportLane("credit")}
            className={`tap-feedback rounded-2xl border p-4 text-left shadow-[0_10px_22px_rgba(15,23,42,0.05)] ${importLane === "credit"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white/80 text-slate-900"
              }`}
          >
            <p
              className={`text-xs font-semibold uppercase tracking-[0.24em] ${importLane === "credit" ? "text-white/80" : "text-slate-500"
                }`}
            >
              Tarjeta de crédito
            </p>
            <p className="mt-1 text-base font-semibold">Estado de cuenta (PDF)</p>
            <p className={`mt-1 text-sm ${importLane === "credit" ? "text-white/80" : "text-slate-600"}`}>
              Optimizado para CMR/Falabella: separa cargos/abonos y arma el estado inteligente.
            </p>
          </button>
        </div>

        {isMobile ? (
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-600">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Nota</p>
            <p className="mt-1">
              La revisión de PDFs se ve mejor en computador. En móvil funciona, pero está optimizada para web.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.pdf"
            disabled={!canImport || loadingPreview}
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="h-11 w-full rounded-2xl border border-border bg-white/90 px-4 text-sm outline-none transition placeholder:text-neutral-400 focus:border-primary"
          />
          <Button onClick={handlePreview} disabled={!canImport || !selectedFile || loadingPreview}>
            {loadingPreview ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analizando
              </>
            ) : (
              <>
                <FileUp className="mr-2 h-4 w-4" />
                {selectedIsPdf ? "Leer PDF con IA" : "Subir y revisar"}
              </>
            )}
          </Button>
        </div>

        {preview?.availableTemplates?.length && !aiUsed ? (
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              disabled={!canImport || loadingPreview}
            >
              {preview.availableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.sourceType === "workspace" ? "Workspace" : "Sistema"} ·{" "}
                  {template.institution} · {template.name}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={handlePreview} disabled={!selectedFile || loadingPreview}>
              Reinterpretar
            </Button>
          </div>
        ) : null}

        {preview ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Filas</p>
              <p className="mt-1 text-xl font-semibold">{preview.summary.totalRows}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Listas</p>
              <p className="mt-1 text-xl font-semibold">{readyToImportCount}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Duplicados</p>
              <p className="mt-1 text-xl font-semibold">
                {normalizedRows.filter((row) => row.duplicateStatus !== "none").length}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Con observaciones</p>
              <p className="mt-1 text-xl font-semibold">
                {normalizedRows.filter((row) => row.issues.length > 0).length}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Plantilla aplicada</p>
              <p className="mt-1 text-sm font-semibold">
                {preview.appliedTemplate
                  ? `${preview.appliedTemplate.sourceType === "workspace" ? "Workspace" : "Sistema"} · ${preview.appliedTemplate.institution} · ${preview.appliedTemplate.name}`
                  : "Modo genérico"}
              </p>
            </div>
          </div>
        ) : null}

        {preview && pdfMeta ? (
          <div className="rounded-[24px] border border-slate-200 bg-white/85 p-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">PDF detectado</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {typeof pdfMeta.institution === "string" ? pdfMeta.institution : "Estado de cuenta"}
                  {typeof pdfMeta.brand === "string" ? ` · ${pdfMeta.brand}` : null}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {aiUsed ? (
                    <span className="inline-flex rounded-full border border-slate-900 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white">
                      Lectura con IA
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                      Detección básica
                    </span>
                  )}
                  {pdfMeta.aiFallbackRecommended === true ? (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                      Revisar
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {typeof pdfMeta.cardLabel === "string" ? pdfMeta.cardLabel : "Tarjeta"}{" "}
                  {typeof pdfMeta.billingPeriodStart === "string" && typeof pdfMeta.billingPeriodEnd === "string"
                    ? `· Período ${pdfMeta.billingPeriodStart} → ${pdfMeta.billingPeriodEnd}`
                    : null}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  {typeof pdfMeta.closingDate === "string" ? (
                    <span>Cierre: {pdfMeta.closingDate}</span>
                  ) : null}
                  {typeof pdfMeta.paymentDate === "string" ? (
                    <span>Pago: {pdfMeta.paymentDate}</span>
                  ) : null}
                  {typeof pdfMeta.totalBilled === "number" ? (
                    <span>Total: {formatCurrencyCLP(pdfMeta.totalBilled)}</span>
                  ) : null}
                  {typeof pdfMeta.minimumDue === "number" ? (
                    <span>Mínimo: {formatCurrencyCLP(pdfMeta.minimumDue)}</span>
                  ) : null}
                  {typeof pdfMeta.creditLimit === "number" ? (
                    <span>Cupo: {formatCurrencyCLP(pdfMeta.creditLimit)}</span>
                  ) : null}
                  {typeof pdfMeta.creditUsed === "number" ? (
                    <span>Usado: {formatCurrencyCLP(pdfMeta.creditUsed)}</span>
                  ) : null}
                  {typeof pdfMeta.creditAvailable === "number" ? (
                    <span>Disponible: {formatCurrencyCLP(pdfMeta.creditAvailable)}</span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {typeof pdfMeta.parserConfidence === "number" ? (
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                      Confianza {Math.round(pdfMeta.parserConfidence * 100)}%
                    </span>
                  ) : null}
                  {typeof pdfMeta.dubiousMovements === "number" ? (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                      Dudosas: {pdfMeta.dubiousMovements}
                    </span>
                  ) : null}
                  {Array.isArray(pdfMeta.missingFields) && pdfMeta.missingFields.length > 0 ? (
                    <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-800">
                      Faltan: {pdfMeta.missingFields.join(", ")}
                    </span>
                  ) : null}
                  {pdfMeta.aiFallbackRecommended === true ? (
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                      Revisión recomendada
                    </span>
                  ) : null}
                </div>
              </div>
              {pdfSuggestion ? (
                <div className="min-w-[240px]">
                  {pdfSuggestion.mode === "matched" && pdfSuggestion.accountId ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      Cuenta sugerida:{" "}
                      <span className="font-semibold">
                        {accountById.get(pdfSuggestion.accountId)?.name ?? "Tarjeta detectada"}
                      </span>
                    </div>
                  ) : null}

                  {pdfSuggestion.mode === "ambiguous" && pdfSuggestion.candidates?.length ? (
                    <div className="space-y-2">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Hay varias tarjetas Falabella/CMR. Elige una para asociar la importación.
                      </div>
                      <Select
                        value={selectedPdfAccountId}
                        onChange={(event) => {
                          const next = event.target.value;
                          setSelectedPdfAccountId(next);
                          if (next) applyPdfAccountToAllRows(next);
                        }}
                      >
                        <option value="">Seleccionar tarjeta</option>
                        {pdfSuggestion.candidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : null}

                  {pdfSuggestion.mode === "missing" && pdfSuggestion.suggestedCreate ? (
                    <div className="space-y-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        No encontramos una tarjeta Falabella/CMR en tu lista. Puedes crearla ahora para que quede asociada automáticamente.
                      </div>
                      <Button
                        variant="secondary"
                        onClick={handleCreateSuggestedAccount}
                        disabled={!canImport || creatingSuggestedAccount}
                      >
                        {creatingSuggestedAccount ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creando...
                          </>
                        ) : (
                          "Crear tarjeta sugerida"
                        )}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {preview?.appliedTemplate ? (
          <div className="rounded-2xl border border-border bg-white/90 px-4 py-3 text-sm">
            <p className="font-medium">
              Plantilla aplicada: {preview.appliedTemplate.institution} · {preview.appliedTemplate.name}
            </p>
            <p className="mt-1 text-neutral-500">
              Modo:{" "}
              {preview.appliedTemplate.mode === "detected"
                ? "detectada automaticamente"
                : preview.appliedTemplate.mode === "manual"
                  ? "seleccion manual"
                  : "fallback generico"}
              {" · "}
              confianza {Math.round(preview.appliedTemplate.confidence * 100)}%
            </p>
          </div>
        ) : null}

        {preview?.warnings.length ? (
          <SurfaceCard
            variant="soft"
            padding="sm"
            className="border-amber-200 bg-amber-50/80 text-sm text-amber-700"
          >
            {preview.warnings.join(" ")}
          </SurfaceCard>
        ) : null}

        {preview?.debug || previewDebug ? (
          <SurfaceCard variant="soft" padding="sm" className="border-slate-200 bg-white/80 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Debug (preview)</p>
            {preview?.debug && previewDebug && preview.debug !== previewDebug ? (
              <p className="mt-1 text-xs text-slate-500">
                (Mostrando debug desde respuesta aunque el preview no se haya montado completamente)
              </p>
            ) : null}
            <div className="mt-2 grid gap-1 text-xs">
              <div>aiUsed: <span className="font-mono">{String((preview?.debug ?? previewDebug)?.aiUsed ?? "—")}</span></div>
              <div>geminiStatus: <span className="font-mono">{String((preview?.debug ?? previewDebug)?.geminiStatus ?? "—")}</span></div>
              <div>geminiError: <span className="font-mono">{String((preview?.debug ?? previewDebug)?.geminiError ?? "—")}</span></div>
              <div>textLength: <span className="font-mono">{String((preview?.debug ?? previewDebug)?.textLength ?? "—")}</span></div>
              {"extractorUsed" in ((preview?.debug ?? previewDebug) ?? {}) ? (
                <div>extractorUsed: <span className="font-mono">{String((preview?.debug ?? previewDebug as any)?.extractorUsed ?? "—")}</span></div>
              ) : null}
              {"extractorError" in ((preview?.debug ?? previewDebug) ?? {}) ? (
                <div>extractorError: <span className="font-mono">{String((preview?.debug ?? previewDebug as any)?.extractorError ?? "—")}</span></div>
              ) : null}
            </div>
          </SurfaceCard>
        ) : null}

        {error && rows.length === 0 ? (
          <ErrorStateCard title="No se pudo generar la vista previa" description={error} />
        ) : null}

        {success ? (
          <SurfaceCard
            variant="soft"
            padding="sm"
            className="border-emerald-200 bg-emerald-50/80 text-sm text-emerald-700"
          >
            {success}
          </SurfaceCard>
        ) : null}

        {commitSummary ? (
          <div className="rounded-2xl border border-border bg-white/90 p-4 text-sm">
            <p className="font-semibold">Resumen final</p>
            <p className="mt-2">Importados: {commitSummary.imported}</p>
            <p>Omitidos: {commitSummary.omitted}</p>
            <p>Duplicados: {commitSummary.duplicates}</p>
            <p>Errores: {commitSummary.errors.length}</p>
          </div>
        ) : null}
      </SurfaceCard>

      {preview && rows.length > 0 ? (
        <SurfaceCard variant="soft" padding="sm" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Revisión previa</h3>
              <p className="text-sm text-slate-600">
                Corrige y clasifica antes de confirmar la importacion.
              </p>
            </div>
            <Button onClick={handleCommit} disabled={committing || readyToImportCount === 0}>
              {committing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando
                </>
              ) : (
                `Guardar ${readyToImportCount} movimientos`
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["all", "normal", "installments"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRowView(value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  rowView === value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white/80 text-slate-700"
                }`}
              >
                {value === "all" ? "Todos" : value === "normal" ? "Movimientos" : "Cuotas"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {rows
              .filter((row) => {
                if (rowView === "all") return true;
                const installment = getInstallmentPreview(row);
                if (rowView === "installments") return installment.isInstallmentPurchase;
                return !installment.isInstallmentPurchase;
              })
              .map((row) => {
              const duplicateLabel = getDuplicateLabel(row.duplicateStatus);
              const selectedAccount = row.accountId ? accountById.get(row.accountId) ?? null : null;
              const showClassification = row.type === "EGRESO" && isCreditCardAccount(selectedAccount);
              const classificationValue = row.classification ?? "PERSONAL";
              const parserMeta = (row as ImportPreviewRow & { parserMeta?: ImportParserMeta }).parserMeta;
              const isCmr = parserMeta?.kind === "falabella-cmr";
              const isAi = parserMeta?.kind === "pdf-ai";
              const cmrClass = isCmr ? (parserMeta.classifiedAs ?? null) : null;
              const cmrSection = isCmr ? (parserMeta.section ?? null) : null;
              const cmrConfidence =
                isCmr && typeof parserMeta.confidence === "number"
                  ? parserMeta.confidence
                  : null;
              const rowDubious = Boolean(parserMeta?.dubious);
              const installmentPreview = getInstallmentPreview(row);

              return (
                <div
                  key={row.id}
                  className="rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Fila #{row.rowNumber}</p>
                      {row.sourceAccountName ? (
                        <p className="text-xs text-slate-500">Origen detectado: {row.sourceAccountName}</p>
                      ) : null}
                      {isAi ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${
                              rowDubious
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-slate-200 bg-slate-50 text-slate-700"
                            }`}
                          >
                            Detectado por IA{rowDubious ? " · Revisar" : ""}
                          </span>
                          {typeof parserMeta?.confidence === "number" ? (
                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
                              {Math.round(parserMeta.confidence * 100)}%
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {cmrClass ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${rowDubious
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-slate-200 bg-slate-50 text-slate-700"
                              }`}
                          >
                            {cmrClass}
                            {cmrSection ? ` · ${cmrSection}` : null}
                          </span>
                          {typeof cmrConfidence === "number" ? (
                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
                              {Math.round(cmrConfidence * 100)}%
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={(event) => updateRow(row.id, { include: event.target.checked })}
                      />
                      Incluir
                    </label>
                  </div>

                  {duplicateLabel ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {duplicateLabel}
                    </div>
                  ) : null}

                  {row.issues.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {row.issues.join(" · ")}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <label className="space-y-2">
                      <span className="text-xs font-medium text-neutral-500">Fecha</span>
                      <Input
                        type="date"
                        value={row.date ?? ""}
                        onChange={(event) => updateRow(row.id, { date: event.target.value || undefined })}
                      />
                    </label>

                    <div className="space-y-2 xl:col-span-2">
                      <span className="text-xs font-medium text-neutral-500">Descripcion</span>
                      <Input
                        value={installmentPreview.descriptionBase || row.description}
                        onChange={(event) =>
                          updateRow(row.id, { description: event.target.value })
                        }
                      />

                      {installmentPreview.isInstallmentPurchase ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-700">
                          <div className="font-medium text-slate-900">
                            {installmentPreview.currentInstallment != null &&
                              installmentPreview.totalInstallments != null
                              ? `Cuota ${installmentPreview.currentInstallment} de ${installmentPreview.totalInstallments}`
                              : "Compra en cuotas"}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            {formatCurrencyCLP(installmentPreview.installmentAmount) ? (
                              <span>Pagas: {formatCurrencyCLP(installmentPreview.installmentAmount)}</span>
                            ) : null}
                            {formatCurrencyCLP(installmentPreview.totalPurchaseAmount) ? (
                              <span>Total: {formatCurrencyCLP(installmentPreview.totalPurchaseAmount)}</span>
                            ) : null}
                            {typeof installmentPreview.remainingInstallments === "number" ? (
                              <span>Restantes: {installmentPreview.remainingInstallments}</span>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <label className="space-y-2">
                      <span className="text-xs font-medium text-neutral-500">Monto</span>
                      <Input
                        type="number"
                        value={row.amount ?? ""}
                        onChange={(event) =>
                          updateRow(row.id, {
                            amount: event.target.value === "" ? undefined : Number(event.target.value)
                          })
                        }
                      />
                    </label>

                    <label className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-neutral-500">Tipo</span>
                        <SuggestionBadge suggestion={row.suggestionMeta?.type} />
                      </div>
                      <Select
                        value={row.type ?? ""}
                        onChange={(event) =>
                          setManualField(row, row.id, "type", {
                            type:
                              event.target.value === ""
                                ? undefined
                                : (event.target.value as "INGRESO" | "EGRESO")
                          })
                        }
                      >
                        <option value="">Seleccionar</option>
                        <option value="INGRESO">Ingreso</option>
                        <option value="EGRESO">Egreso</option>
                      </Select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs font-medium text-neutral-500">Saldo</span>
                      <Input
                        type="number"
                        value={row.balance ?? ""}
                        onChange={(event) =>
                          updateRow(row.id, {
                            balance: event.target.value === "" ? null : Number(event.target.value)
                          })
                        }
                      />
                    </label>

                    <label className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-neutral-500">Categoria</span>
                        <SuggestionBadge suggestion={row.suggestionMeta?.categoryId} />
                      </div>
                      <Select
                        value={row.categoryId ?? ""}
                        onChange={(event) =>
                          setManualField(row, row.id, "categoryId", {
                            categoryId: event.target.value || undefined
                          })
                        }
                      >
                        <option value="">Sin categoria</option>
                        {preview.references.categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </Select>
                    </label>

                    <label className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-neutral-500">Unidad de negocio</span>
                        <SuggestionBadge suggestion={row.suggestionMeta?.businessUnitId} />
                      </div>
                      <Select
                        value={row.businessUnitId ?? ""}
                        onChange={(event) => {
                          const businessUnitId = event.target.value || undefined;
                          const selectedUnit = preview.references.businessUnits.find(
                            (item) => item.id === businessUnitId
                          );
                          setManualField(row, row.id, "businessUnitId", {
                            businessUnitId,
                            financialOrigin: selectedUnit?.type === "NEGOCIO" ? "EMPRESA" : row.financialOrigin
                          });
                        }}
                      >
                        <option value="">Sin asignar</option>
                        {preview.references.businessUnits.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name}
                          </option>
                        ))}
                      </Select>
                    </label>

                    <label className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-neutral-500">Origen financiero</span>
                        <SuggestionBadge suggestion={row.suggestionMeta?.financialOrigin} />
                      </div>
                      <Select
                        value={row.financialOrigin}
                        onChange={(event) =>
                          setManualField(row, row.id, "financialOrigin", {
                            financialOrigin: event.target.value as "PERSONAL" | "EMPRESA"
                          })
                        }
                      >
                        <option value="PERSONAL">Personal</option>
                        <option value="EMPRESA">Empresa</option>
                      </Select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs font-medium text-neutral-500">Cuenta interna</span>
                      <Select
                        value={row.accountId ?? ""}
                        onChange={(event) => {
                          const accountId = event.target.value || undefined;
                          updateRow(row.id, { accountId });
                        }}
                      >
                        <option value="">Sin asignar</option>
                        {preview.references.accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                  </div>

                  {showClassification ? (
                    <div className="mt-4 rounded-[22px] border border-slate-200 bg-white/85 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Clasificación (tarjeta crédito)
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Personal, negocio o prestado. Si eliges prestado, se crea deuda automática en Pendientes.
                      </p>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <label className="space-y-2">
                          <span className="text-xs font-medium text-neutral-500">Tipo</span>
                          <Select
                            value={classificationValue}
                            onChange={(event) => {
                              const next = event.target.value as "PERSONAL" | "NEGOCIO" | "PRESTADO";
                              if (next === "PERSONAL") {
                                updateRow(row.id, {
                                  classification: "PERSONAL",
                                  financialOrigin: "PERSONAL",
                                  businessUnitId: undefined,
                                  isReimbursable: false,
                                  isBusinessPaidPersonally: false,
                                  debtorName: undefined,
                                  owedAmount: undefined,
                                  isInstallmentDebt: undefined,
                                  installmentCount: undefined,
                                  installmentValue: undefined,
                                  nextInstallmentDate: null,
                                  debtNote: null
                                });
                              } else if (next === "NEGOCIO") {
                                updateRow(row.id, {
                                  classification: "NEGOCIO",
                                  financialOrigin: "EMPRESA",
                                  isReimbursable: false,
                                  isBusinessPaidPersonally: true
                                });
                              } else {
                                updateRow(row.id, {
                                  classification: "PRESTADO",
                                  financialOrigin: "PERSONAL",
                                  businessUnitId: undefined,
                                  isReimbursable: true,
                                  isBusinessPaidPersonally: false,
                                  owedAmount:
                                    typeof row.amount === "number" ? Math.abs(row.amount) : undefined,
                                  nextInstallmentDate: row.nextInstallmentDate ?? null,
                                  debtNote: row.debtNote ?? null
                                });
                              }
                            }}
                          >
                            <option value="PERSONAL">Personal</option>
                            <option value="NEGOCIO">Negocio</option>
                            <option value="PRESTADO">Prestado</option>
                          </Select>
                        </label>

                        {classificationValue === "NEGOCIO" ? (
                          <label className="space-y-2 md:col-span-2">
                            <span className="text-xs font-medium text-neutral-500">Unidad de negocio</span>
                            <Select
                              value={row.businessUnitId ?? ""}
                              onChange={(event) => {
                                const businessUnitId = event.target.value || undefined;
                                updateRow(row.id, {
                                  businessUnitId,
                                  financialOrigin: businessUnitId ? "EMPRESA" : row.financialOrigin,
                                  isBusinessPaidPersonally: true
                                });
                              }}
                            >
                              <option value="">Selecciona negocio</option>
                              {preview.references.businessUnits.map((unit) => (
                                <option key={unit.id} value={unit.id}>
                                  {unit.name}
                                </option>
                              ))}
                            </Select>
                          </label>
                        ) : null}

                        {classificationValue === "PRESTADO" ? (
                          <>
                            <label className="space-y-2 md:col-span-2">
                              <span className="text-xs font-medium text-neutral-500">Persona</span>
                              <Input
                                placeholder="Nombre de quien te debe"
                                value={row.debtorName ?? ""}
                                onChange={(event) => updateRow(row.id, { debtorName: event.target.value })}
                                list={`debtor-names-${row.id}`}
                              />
                              <datalist id={`debtor-names-${row.id}`}>
                                {debtorNameOptions.map((name) => (
                                  <option key={name} value={name} />
                                ))}
                              </datalist>
                            </label>

                            <label className="space-y-2">
                              <span className="text-xs font-medium text-neutral-500">Monto adeudado</span>
                              <Input
                                type="number"
                                value={
                                  row.owedAmount ??
                                  (typeof row.amount === "number" ? Math.abs(row.amount) : "")
                                }
                                onChange={(event) =>
                                  updateRow(row.id, {
                                    owedAmount: event.target.value === "" ? undefined : Number(event.target.value)
                                  })
                                }
                              />
                            </label>

                            <label className="mt-1 flex items-center gap-2 text-sm md:col-span-3">
                              <input
                                type="checkbox"
                                checked={Boolean(row.isInstallmentDebt)}
                                onChange={(event) => {
                                  const checked = event.target.checked;
                                  if (!checked) {
                                    updateRow(row.id, {
                                      isInstallmentDebt: false,
                                      installmentCount: undefined,
                                      installmentValue: undefined,
                                      nextInstallmentDate: null
                                    });
                                    return;
                                  }
                                  const count =
                                    row.installmentCount && row.installmentCount > 0
                                      ? row.installmentCount
                                      : 3;
                                  const baseAmount =
                                    typeof row.owedAmount === "number"
                                      ? row.owedAmount
                                      : typeof row.amount === "number"
                                        ? Math.abs(row.amount)
                                        : 0;
                                  const value =
                                    row.installmentValue && row.installmentValue > 0
                                      ? row.installmentValue
                                      : Math.ceil(baseAmount / Math.max(1, count));
                                  updateRow(row.id, {
                                    isInstallmentDebt: true,
                                    installmentCount: count,
                                    installmentValue: value,
                                    nextInstallmentDate:
                                      row.nextInstallmentDate ?? computeDefaultNextInstallmentDate(row.date)
                                  });
                                }}
                              />
                              Registrar deuda en cuotas (opcional)
                            </label>

                            {row.isInstallmentDebt ? (
                              <div className="grid gap-3 md:col-span-3 md:grid-cols-3">
                                <label className="space-y-2">
                                  <span className="text-xs font-medium text-neutral-500">Total cuotas</span>
                                  <Input
                                    type="number"
                                    value={row.installmentCount ?? ""}
                                    onChange={(event) =>
                                      updateRow(row.id, {
                                        installmentCount:
                                          event.target.value === "" ? undefined : Number(event.target.value)
                                      })
                                    }
                                  />
                                </label>

                                <label className="space-y-2">
                                  <span className="text-xs font-medium text-neutral-500">Valor cuota</span>
                                  <Input
                                    type="number"
                                    value={row.installmentValue ?? ""}
                                    onChange={(event) =>
                                      updateRow(row.id, {
                                        installmentValue:
                                          event.target.value === "" ? undefined : Number(event.target.value)
                                      })
                                    }
                                  />
                                </label>

                                <label className="space-y-2">
                                  <span className="text-xs font-medium text-neutral-500">Próxima cuota</span>
                                  <Input
                                    type="date"
                                    value={row.nextInstallmentDate ?? ""}
                                    onChange={(event) =>
                                      updateRow(row.id, { nextInstallmentDate: event.target.value || null })
                                    }
                                  />
                                </label>
                              </div>
                            ) : null}

                            <label className="space-y-2 md:col-span-3">
                              <span className="text-xs font-medium text-neutral-500">Nota (opcional)</span>
                              <Input
                                placeholder="Ej: Compra prestada con mi tarjeta"
                                value={row.debtNote ?? ""}
                                onChange={(event) => updateRow(row.id, { debtNote: event.target.value || null })}
                              />
                            </label>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <label className="mt-4 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.isReimbursable}
                      onChange={(event) =>
                        setManualField(row, row.id, "isReimbursable", {
                          isReimbursable: event.target.checked
                        })
                      }
                    />
                    Marcar como gasto empresarial pagado por mi / reembolsable
                  </label>

                  <div className="mt-2 flex items-center gap-2">
                    <SuggestionBadge suggestion={row.suggestionMeta?.isReimbursable} />
                    <SuggestionBadge suggestion={row.suggestionMeta?.isBusinessPaidPersonally} />
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.isBusinessPaidPersonally}
                      onChange={(event) =>
                        setManualField(row, row.id, "isBusinessPaidPersonally", {
                          isBusinessPaidPersonally: event.target.checked
                        })
                      }
                    />
                    Marcar como gasto empresarial pagado personalmente
                  </label>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
