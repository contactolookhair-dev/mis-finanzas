function normalizeOptionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : undefined;
}

function normalizeImportType(value?: string) {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();
  if (normalized === "credit" || normalized === "credit_card" || normalized === "tarjeta") {
    return "credit" as const;
  }
  if (normalized === "account" || normalized === "debit" || normalized === "current_account") {
    return "account" as const;
  }
  return undefined;
}

function getFriendlyPreviewError(message?: string) {
  const fallback =
    "No pudimos leer este PDF con la configuración actual. Intenta nuevamente o revisa la cuenta seleccionada.";

  if (!message) {
    return fallback;
  }

  if (
    message.includes("did not match the expected pattern") ||
    message.includes("expected pattern")
  ) {
    return fallback;
  }

  return fallback;
}

const DEBUG_IMPORT_PREVIEW = process.env.DEBUG_IMPORT_PREVIEW === "true";

function safeJsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function jsonPreviewError(message?: string, debug?: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    success: false,
    error: "preview_failed",
    message: getFriendlyPreviewError(message)
  };
  if (debug && typeof debug === "object") {
    payload.debug = debug;
  }
  return safeJsonResponse(payload);
}

function buildStageLog(params: {
  stage: string;
  fileName?: string | null;
  mimeType?: string | null;
  textLength?: number | null;
  rowsCount?: number | null;
  errorMessage?: string | null;
}) {
  return {
    stage: params.stage,
    fileName: params.fileName ?? null,
    mimeType: params.mimeType ?? null,
    textLength: typeof params.textLength === "number" ? params.textLength : null,
    rowsCount: typeof params.rowsCount === "number" ? params.rowsCount : null,
    errorMessage: params.errorMessage ?? null
  };
}

function buildDebugPayload(params: {
  stage: string;
  errorMessage?: string;
  parser?: string;
  supported?: boolean;
  looksLikePdf?: boolean;
  textLength?: number;
  rowsCount?: number;
}) {
  const { stage, errorMessage, parser, supported, looksLikePdf, textLength, rowsCount } = params;
  return {
    stage,
    errorMessage: DEBUG_IMPORT_PREVIEW ? ((errorMessage ?? null) && String(errorMessage).slice(0, 500)) : null,
    parser: parser ?? null,
    supported: supported ?? null,
    fileAppearsPdf: looksLikePdf ?? null,
    textLength: typeof textLength === "number" ? textLength : null,
    rowsCount: typeof rowsCount === "number" ? rowsCount : null
  };
}

function resolveFunctionalPreviewMessage(params: { stage: string; errorMessage?: string; warnings?: string[] }) {
  const { stage, errorMessage, warnings } = params;
  const raw = (errorMessage ?? "").toLowerCase();
  const firstWarning = warnings?.[0];

  if (warnings?.some((warning) => warning.toLowerCase().includes("texto seleccionable"))) {
    return "Este PDF no contiene texto seleccionable suficiente para generar la vista previa.";
  }

  if (raw.includes("formato de archivo no soportado")) {
    return "No pudimos identificar el formato del archivo. Sube un PDF, CSV o Excel válido.";
  }

  if (raw.includes("no se pudo leer el pdf")) {
    return "No fue posible leer el contenido del PDF. Revisa que no esté protegido o dañado.";
  }

  if (stage === "build_preview") {
    return "No pudimos preparar la vista previa con la configuración actual. Intenta nuevamente.";
  }

  return getFriendlyPreviewError(errorMessage);
}

// Ensure this route is always treated as dynamic in Next.js App Router.
// This avoids accidental static optimization and guarantees request body parsing is available.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let stage = "init";
  let previewResult: Record<string, unknown> | null = null;
  let looksLikePdf = false;
  let safeFile: File | null = null;
  let safeBytes: Uint8Array | null = null;
  let safeTextLength = 0;
  let safeRowsCount = 0;
  const debugEntries: Array<{ stage: string; payload?: Record<string, unknown> }> = [];
  let formData: FormData | null = null;
  let selectedTemplateId: FormDataEntryValue | null = null;
  let importTypeRaw: string | undefined = undefined;
  let importType: ReturnType<typeof normalizeImportType> = undefined;
  let preferredAccountId: string | undefined = undefined;

  const recordStage = (name: string, payload?: Record<string, unknown>) => {
    if (DEBUG_IMPORT_PREVIEW) {
      debugEntries.push({ stage: name, payload });
      console.log("imports preview stage", name, payload ?? "no payload");
    }
  };

  const logStage = (name: string, params?: { errorMessage?: string | null }) => {
    if (!DEBUG_IMPORT_PREVIEW) return;
    console.log(
      "[imports/preview]",
      JSON.stringify(
        buildStageLog({
          stage: name,
          fileName: safeFile ? safeFile.name : null,
          mimeType: safeFile ? safeFile.type : null,
          textLength: safeTextLength,
          rowsCount: safeRowsCount,
          errorMessage: params?.errorMessage ?? null
        })
      )
    );
  };

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === "object" && !Array.isArray(value));

  const safePreviewResult = () => (isPlainObject(previewResult) ? previewResult : {});

  logStage("request_received");

  if (process.env.DEBUG_IMPORT_PREVIEW_ISOLATE === "true") {
    console.warn("imports preview isolation mode active");
    return safeJsonResponse({ success: true, isolated: true });
  }
  try {
    // 1) Always read the upload first so we can debug uploads and provide a fallback preview
    // even if auth/workspace context is missing.
    stage = "read_form_data";
    recordStage(stage);
    console.log("[imports/preview] about to read formData");
    formData = await request.formData();
    const keys = Array.from(formData.keys()).slice(0, 50);
    const rawFile = formData.get("file");
    if (rawFile instanceof File) safeFile = rawFile;

    // Mandatory visibility for production debugging: confirms the field name and whether a File arrived.
    console.log("[imports/preview] read_form_data", {
      keys,
      hasFile: rawFile instanceof File
    });

    if (!(rawFile instanceof File)) {
      logStage("preview_failed", { errorMessage: "missing_file" });
      return safeJsonResponse({
        success: false,
        error: "preview_failed",
        message: "No se recibio ningun archivo. Intenta nuevamente.",
        debug: {
          ...buildDebugPayload({ stage: "missing_file" }),
          formDataKeys: keys,
          hasFileField: formData.has("file")
        }
      });
    }

    selectedTemplateId = formData.get("templateId");
    importTypeRaw = normalizeOptionalString(formData.get("type"));
    importType = normalizeImportType(importTypeRaw);
    preferredAccountId = normalizeOptionalString(formData.get("accountId"));

    stage = "read_file_bytes";
    recordStage(stage);
    safeBytes = new Uint8Array(await rawFile.arrayBuffer());
    looksLikePdf =
      safeBytes.length >= 5 &&
      safeBytes[0] === 0x25 &&
      safeBytes[1] === 0x50 &&
      safeBytes[2] === 0x44 &&
      safeBytes[3] === 0x46 &&
      safeBytes[4] === 0x2d;

    console.log("imports preview received", {
      fileName: safeFile ? safeFile.name : null,
      mimeType: safeFile ? safeFile.type : null,
      fileSize: safeBytes.byteLength,
      importTypeRaw,
      importType,
      preferredAccountId,
      selectedTemplateId: normalizeOptionalString(selectedTemplateId)
    });

    // Local-only bypass to allow debugging the endpoint without auth/session.
    // Do NOT enable this in production.
    if (process.env.DEBUG_IMPORT_PREVIEW_BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production") {
      stage = "read_form_data";
      recordStage(stage);
      const bypassFile = formData.get("file");
      if (bypassFile instanceof File) safeFile = bypassFile;
      if (!(bypassFile instanceof File)) {
        logStage("preview_failed", { errorMessage: "missing_file" });
        return safeJsonResponse({
          success: false,
          error: "preview_failed",
          message: "Falta el archivo PDF.",
          debug: buildDebugPayload({ stage: "missing_file" })
        });
      }

      logStage("file_parsed");

      stage = "read_file_bytes";
      recordStage(stage);
      const bytes = safeBytes ?? new Uint8Array(await bypassFile.arrayBuffer());
      safeBytes = bytes;
      looksLikePdf =
        bytes.length >= 5 &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46 &&
        bytes[4] === 0x2d;

      stage = "build_preview";
      recordStage(stage);
      const { previewImportFile } = await import("@/server/services/import-service");
      const rawPreview = await previewImportFile({
        workspaceId: "debug",
        fileName: bypassFile.name,
        mimeType: bypassFile.type,
        bytes,
        preferredImportType: normalizeImportType(normalizeOptionalString(formData.get("type"))),
        preferredAccountId: normalizeOptionalString(formData.get("accountId")),
        selectedTemplateId: normalizeOptionalString(formData.get("templateId"))
      });

      previewResult = isPlainObject(rawPreview) ? rawPreview : {};
      safeRowsCount = Array.isArray(previewResult?.rows) ? previewResult.rows.length : 0;
      const debugFromService =
        previewResult && typeof previewResult === "object" && "debug" in previewResult
          ? (previewResult as any).debug
          : null;
      if (debugFromService && typeof debugFromService === "object" && typeof debugFromService.textLength === "number") {
        safeTextLength = debugFromService.textLength;
        logStage("text_extracted");
      }

      logStage("rows_built");
      logStage("preview_response_sent");
      return safeJsonResponse(
        JSON.parse(JSON.stringify({
          success: true,
          ...safePreviewResult(),
          supported: true
        }))
      );
    }

    if (importTypeRaw && !importType) {
      console.warn("imports preview unknown type", { importTypeRaw });
    }

    if (preferredAccountId && (preferredAccountId.includes("...") || preferredAccountId.includes("…"))) {
      console.warn("imports preview accountId appears truncated", { preferredAccountId });
    }

    // 2) Best-effort auth/context. If it fails, DO NOT return early: we can still give a fallback preview.
    let context: { workspaceId?: string; userKey?: string; role?: string } | null = null;
    let hasPreviewPermission = false;
    try {
      stage = "load_dependencies:tenant:start";
      recordStage(stage);
      const tenantModule = await import("@/server/tenant/workspace-context");
      stage = "load_dependencies:tenant:ok";
      recordStage(stage);

      stage = "load_dependencies:permissions:start";
      recordStage(stage);
      const permissionsModule = await import("@/server/permissions/permissions");
      stage = "load_dependencies:permissions:ok";
      recordStage(stage);

      const { getWorkspaceContextFromRequest } = tenantModule as any;
      const { hasPermission } = permissionsModule as any;

      stage = "resolve_context";
      recordStage(stage);
      context = await getWorkspaceContextFromRequest(request as never);
      hasPreviewPermission = Boolean(
        context?.workspaceId && context?.userKey && context?.role && hasPermission(context.role, "transactions:import")
      );
      if (!hasPreviewPermission) {
        console.warn("imports preview context/permission missing; falling back to unauth preview", {
          workspaceId: context?.workspaceId ?? null,
          role: context?.role ?? null
        });
      }
    } catch (contextError) {
      console.warn("imports preview context failed; falling back to unauth preview", {
        stage,
        message: contextError instanceof Error ? contextError.message : String(contextError)
      });
      context = null;
      hasPreviewPermission = false;
    }

    // 3) If we have context + permission, use the full import-service preview.
    // Otherwise, fall back to a minimal preview built from extracted text.
    if (hasPreviewPermission && context?.workspaceId && context.userKey) {
      stage = "load_dependencies:import-service:start";
      recordStage(stage);
      const importServiceModule = await import("@/server/services/import-service");
      stage = "load_dependencies:import-service:ok";
      recordStage(stage);
      const { previewImportFile } = importServiceModule as any;

      const bytes = safeBytes!;
      stage = "build_preview";
      recordStage(stage, {
        fileName: safeFile ? safeFile.name : null,
        fileType: safeFile ? safeFile.type : null,
        fileSize: bytes.byteLength
      });
      const rawPreview = await previewImportFile({
        workspaceId: context.workspaceId,
        userKey: context.userKey,
        fileName: safeFile?.name ?? "upload.pdf",
        mimeType: safeFile?.type ?? "",
        bytes,
        selectedTemplateId: typeof selectedTemplateId === "string" ? selectedTemplateId : undefined,
        preferredAccountId,
        preferredImportType: importType
      });
      previewResult = isPlainObject(rawPreview) ? rawPreview : {};
      safeRowsCount = Array.isArray(previewResult?.rows) ? previewResult.rows.length : 0;
      const debugFromService =
        previewResult && typeof previewResult === "object" && "debug" in previewResult
          ? (previewResult as any).debug
          : null;
      if (debugFromService && typeof debugFromService === "object" && typeof debugFromService.textLength === "number") {
        safeTextLength = debugFromService.textLength;
        logStage("text_extracted");
      }
      if (debugFromService && typeof debugFromService === "object" && typeof debugFromService.aiUsed === "boolean") {
        logStage("ai_attempted", { errorMessage: debugFromService.aiUsed ? null : "ai_not_used" });
      }
      recordStage("preview_built", {
        parser: previewResult.parser,
        rows: Array.isArray(previewResult.rows) ? previewResult.rows.length : 0
      });
      logStage("rows_built");
    } else if (looksLikePdf && safeBytes) {
      // Unauthenticated fallback: extract text and build minimal rows so the UI can render/edit.
      stage = "build_preview:fallback_unauth";
      recordStage(stage);
      const { extractPdfTextFromBytes } = await import("@/server/services/import/pdf-text-extractor");
      const extraction = await extractPdfTextFromBytes(safeBytes);
      if (!extraction.ok) {
        safeTextLength = 0;
        safeRowsCount = 0;
        logStage("preview_failed", { errorMessage: extraction.error });
        return safeJsonResponse({
          success: false,
          error: "preview_failed",
          message: resolveFunctionalPreviewMessage({
            stage: "extract_text",
            errorMessage: extraction.message
          }),
          debug: {
            ...buildDebugPayload({
              stage: "extract_text",
              errorMessage: extraction.message,
              parser: "pdf",
              supported: false,
              looksLikePdf: true,
              textLength: 0,
              rowsCount: 0
            }),
            extractorDebug: extraction.debug
          }
        });
      }

      const rawText = extraction.text;
      safeTextLength = rawText.length;
      logStage("text_extracted");
      const lines = rawText
        .split(/\r?\n/)
        .map((l) => l.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
        .filter(Boolean);

      const extractDate = (value: string) => {
        const match = value.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
        return match?.[1] ?? null;
      };
      const extractAmount = (value: string) => {
        const match = value.match(/-?\$?\(?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?\)?/);
        if (!match) return null;
        const token = match[0].trim();
        const negative = token.includes("(") || token.startsWith("-");
        const sanitized = token.replace(/[$()\s-]/g, "");
        const normalized = sanitized.includes(",")
          ? sanitized.replace(/\./g, "").replace(",", ".")
          : sanitized.replace(/\./g, "");
        const parsed = Number(normalized);
        if (!Number.isFinite(parsed)) return null;
        return negative ? -Math.abs(parsed) : parsed;
      };

      const meaningfulLines = lines.filter((l) => l.length > 5);
      const ensuredLines = meaningfulLines.length > 0 ? meaningfulLines : lines.length > 0 ? lines : [rawText.slice(0, 400)];
      const rowsFallback = ensuredLines.map((line, index) => ({
        id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(index + 1),
        rowNumber: index + 1,
        date: extractDate(line) ?? undefined,
        description: line,
        amount: (() => {
          const amount = extractAmount(line);
          return typeof amount === "number" ? Math.abs(amount) : undefined;
        })(),
        rawValues: { raw: line, needsReview: true },
        issues: [],
        include: true,
        financialOrigin: "PERSONAL",
        isReimbursable: false,
        isBusinessPaidPersonally: false,
        duplicateStatus: "none",
        suggestionMeta: {}
      }));

      safeRowsCount = rowsFallback.length;
      logStage("rows_built");
      logStage("preview_response_sent");
      return safeJsonResponse({
        success: true,
        parser: "pdf",
        supported: true,
        warnings: [],
        debug: {
          ...buildDebugPayload({
            stage: "fallback_unauth_preview",
            parser: "pdf",
            supported: true,
            looksLikePdf: true,
            textLength: safeTextLength,
            rowsCount: safeRowsCount
          }),
          authBypassed: true
        },
        rows: rowsFallback,
        summary: {
          totalRows: rowsFallback.length,
          readyToImport: rowsFallback.length,
          duplicates: 0,
          invalid: 0
        },
        references: { categories: [], businessUnits: [], accounts: [] },
        availableTemplates: [],
        appliedTemplate: null,
        pdfMeta: null,
        pdfAccountSuggestion: null
      });
    }

    if (previewResult?.parser === "pdf" && !previewResult.supported) {
      // Temporary rule: never block the user if we extracted text or produced rows.
      // If there are rows, return success:true so the UI renders the editable preview.
      if (safeRowsCount > 0 || safeTextLength > 0) {
        logStage("preview_response_sent");
        return safeJsonResponse(
          JSON.parse(JSON.stringify({
            success: true,
            ...safePreviewResult(),
            supported: true
          }))
        );
      }

      const message = resolveFunctionalPreviewMessage({
        stage: "unsupported_pdf",
        warnings: Array.isArray(previewResult?.warnings)
          ? previewResult.warnings.filter((warning): warning is string => typeof warning === "string")
          : undefined
      });
      recordStage("unsupported_response", { parser: previewResult.parser });
      logStage("preview_failed", { errorMessage: message });
      return safeJsonResponse({
        success: false,
        error: "preview_not_supported",
        message,
        debug: buildDebugPayload({
          stage: "unsupported_pdf",
          parser: typeof previewResult.parser === "string" ? previewResult.parser : undefined,
          supported: typeof previewResult.supported === "boolean" ? previewResult.supported : undefined,
          looksLikePdf,
          textLength: safeTextLength,
          rowsCount: safeRowsCount
        })
      });
    }

    stage = "build_response";
    recordStage(stage, { success: true });
    logStage("preview_response_sent");
    return safeJsonResponse(
      JSON.parse(JSON.stringify({
        success: true,
        ...safePreviewResult()
      }))
    );
  } catch (error) {
      console.error("imports preview failed", {
        stage,
        file: safeFile ? { name: safeFile.name, type: safeFile.type, size: safeFile.size } : null,
        error,
        stack: error instanceof Error ? error.stack : null
      });
    const message = resolveFunctionalPreviewMessage({
      stage,
      errorMessage: error instanceof Error ? error.message : undefined
    });
    const errorMessage = error instanceof Error ? error.message : String(error);

    // If we already know there's text (or we can extract it here), do not block the preview.
    // Return a minimal editable fallback instead of success:false.
    if (looksLikePdf && safeBytes) {
      try {
        const { extractPdfTextFromBytes } = await import("@/server/services/import/pdf-text-extractor");
        const extraction = await extractPdfTextFromBytes(safeBytes);
          if (extraction.ok) {
            const rawText = extraction.text;
            safeTextLength = rawText.length;
            logStage("text_extracted");
            const lines = rawText
              .split(/\r?\n/)
              .map((l) => l.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
              .filter(Boolean);

          const extractDate = (value: string) => {
            const match = value.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
            return match?.[1] ?? null;
          };
          const extractAmount = (value: string) => {
            const match = value.match(/-?\$?\(?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?\)?/);
            if (!match) return null;
            const token = match[0].trim();
            const negative = token.includes("(") || token.startsWith("-");
            const sanitized = token.replace(/[$()\s-]/g, "");
            const normalized = sanitized.includes(",")
              ? sanitized.replace(/\./g, "").replace(",", ".")
              : sanitized.replace(/\./g, "");
            const parsed = Number(normalized);
            if (!Number.isFinite(parsed)) return null;
            return negative ? -Math.abs(parsed) : parsed;
          };

          const cleanedLines = lines.map((l) => l.trim()).filter(Boolean);
          const meaningfulLines = cleanedLines.filter((l) => l.length > 5);
          const ensuredLines = (meaningfulLines.length > 0 ? meaningfulLines : cleanedLines).length > 0
            ? (meaningfulLines.length > 0 ? meaningfulLines : cleanedLines)
            : rawText.trim().length > 0
              ? [rawText.trim().slice(0, 400)]
              : [];

          const rowsFallback = ensuredLines.map((line, index) => ({
            id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(index + 1),
            rowNumber: index + 1,
            date: extractDate(line) ?? undefined,
            description: line,
            amount: (() => {
              const amount = extractAmount(line);
              return typeof amount === "number" ? Math.abs(amount) : undefined;
            })(),
            rawValues: { raw: line, needsReview: true },
            issues: [],
            include: true,
            financialOrigin: "PERSONAL",
            isReimbursable: false,
            isBusinessPaidPersonally: false,
            duplicateStatus: "none",
            suggestionMeta: {}
          }));

          safeRowsCount = rowsFallback.length;
          logStage("preview_response_sent", { errorMessage: "fallback_rows_from_catch" });

          return safeJsonResponse({
            success: true,
            parser: "pdf",
            supported: true,
            warnings: [
              "Tuvimos un problema preparando la vista previa completa, pero igual puedes revisar y editar los movimientos detectados antes de guardar."
            ],
            debug: buildDebugPayload({
              stage,
              errorMessage,
              parser: "pdf",
              supported: true,
              looksLikePdf: true,
              textLength: safeTextLength,
              rowsCount: safeRowsCount
            }),
            rows: rowsFallback,
            summary: {
              totalRows: rowsFallback.length,
              readyToImport: rowsFallback.length,
              duplicates: 0,
              invalid: 0
            },
            references: { categories: [], businessUnits: [], accounts: [] },
            availableTemplates: [],
            appliedTemplate: null,
            pdfMeta: null,
            pdfAccountSuggestion: null
          });
        }
      } catch (fallbackError) {
        console.error("imports preview fallback failed", fallbackError);
      }
    }

    logStage("preview_failed", { errorMessage });

    // Final rule: only return success:false when we truly have no text to show/edit.
    return safeJsonResponse({
      success: false,
      error: "preview_failed",
      message,
      debug: buildDebugPayload({
        stage,
        errorMessage,
        parser: typeof previewResult?.parser === "string" ? previewResult.parser : undefined,
        supported: typeof previewResult?.supported === "boolean" ? previewResult.supported : undefined,
        looksLikePdf,
        textLength: safeTextLength,
        rowsCount: safeRowsCount
      })
    });
  }
}
