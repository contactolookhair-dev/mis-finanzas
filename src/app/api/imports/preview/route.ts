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
  if (DEBUG_IMPORT_PREVIEW && debug && typeof debug === "object") {
    payload.debug = debug;
  }
  return safeJsonResponse(payload);
}

function buildDebugPayload(params: {
  stage: string;
  errorMessage?: string;
  parser?: string;
  supported?: boolean;
  looksLikePdf?: boolean;
}) {
  if (!DEBUG_IMPORT_PREVIEW) return undefined;
  const { stage, errorMessage, parser, supported, looksLikePdf } = params;
  return {
    stage,
    errorMessage: errorMessage ?? null,
    parser: parser ?? null,
    supported: supported ?? null,
    fileAppearsPdf: looksLikePdf ?? null
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

export async function POST(request: Request) {
  let stage = "init";
  let previewResult: Record<string, unknown> | null = null;
  let looksLikePdf = false;
  const debugEntries: Array<{ stage: string; payload?: Record<string, unknown> }> = [];

  const recordStage = (name: string, payload?: Record<string, unknown>) => {
    if (DEBUG_IMPORT_PREVIEW) {
      debugEntries.push({ stage: name, payload });
      console.log("imports preview stage", name, payload ?? "no payload");
    }
  };

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === "object" && !Array.isArray(value));

  const safePreviewResult = () => (isPlainObject(previewResult) ? previewResult : {});

  if (process.env.DEBUG_IMPORT_PREVIEW_ISOLATE === "true") {
    console.warn("imports preview isolation mode active");
    return safeJsonResponse({ success: true, isolated: true });
  }
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

    stage = "load_dependencies:import-service:start";
    recordStage(stage);
    const importServiceModule = await import("@/server/services/import-service");
    stage = "load_dependencies:import-service:ok";
    recordStage(stage);

    const { getWorkspaceContextFromRequest } = tenantModule;
    const { hasPermission } = permissionsModule;
    const { previewImportFile } = importServiceModule;

    stage = "resolve_context";
    recordStage(stage);
    const context = await getWorkspaceContextFromRequest(request as never);
    if (!context.workspaceId || !context.userKey || !context.role) {
      console.warn("imports preview auth context missing");
      return jsonPreviewError();
    }
    if (!hasPermission(context.role, "transactions:import")) {
      console.warn("imports preview permission denied", { role: context.role });
      return jsonPreviewError();
    }

    stage = "read_form_data";
    recordStage(stage);
    recordStage(stage);
    const formData = await request.formData();
    const file = formData.get("file");
    const selectedTemplateId = formData.get("templateId");
    const importTypeRaw = normalizeOptionalString(formData.get("type"));
    const importType = normalizeImportType(importTypeRaw);
    const preferredAccountId = normalizeOptionalString(formData.get("accountId"));

    console.log("imports preview received", {
      workspaceId: context.workspaceId,
      fileName: file instanceof File ? file.name : null,
      mimeType: file instanceof File ? file.type : null,
      importTypeRaw,
      importType,
      preferredAccountId,
      fileSize: file instanceof File ? file.size : null,
      selectedTemplateId: normalizeOptionalString(selectedTemplateId)
    });

    if (!(file instanceof File)) {
      return jsonPreviewError();
    }

    if (importTypeRaw && !importType) {
      console.warn("imports preview unknown type", { importTypeRaw });
    }

    if (preferredAccountId && (preferredAccountId.includes("...") || preferredAccountId.includes("…"))) {
      console.warn("imports preview accountId appears truncated", { preferredAccountId });
    }

    stage = "read_file_bytes";
    recordStage(stage);
    recordStage(stage);
    const bytes = new Uint8Array(await file.arrayBuffer());
    looksLikePdf =
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d;
    console.log("imports preview parsing", {
      fileName: file.name,
      fileSize: bytes.byteLength,
      importType,
      preferredAccountId
    });

    stage = "build_preview";
    recordStage(stage, { fileName: file.name });
    const rawPreview = await previewImportFile({
      workspaceId: context.workspaceId,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      selectedTemplateId: typeof selectedTemplateId === "string" ? selectedTemplateId : undefined,
      preferredAccountId,
      preferredImportType: importType
    });
    previewResult = isPlainObject(rawPreview) ? rawPreview : {};
    recordStage("preview_built", { parser: previewResult.parser });

    if (previewResult?.parser === "pdf" && !previewResult.supported) {
      const message = resolveFunctionalPreviewMessage({
        stage: "unsupported_pdf",
        warnings: Array.isArray(previewResult?.warnings)
          ? previewResult.warnings.filter((warning): warning is string => typeof warning === "string")
          : undefined
      });
      recordStage("unsupported_response", { parser: previewResult.parser });
      return safeJsonResponse({
        success: false,
        error: "preview_not_supported",
        message,
        debug: buildDebugPayload({
          stage: "unsupported_pdf",
          parser: typeof previewResult.parser === "string" ? previewResult.parser : undefined,
          supported: typeof previewResult.supported === "boolean" ? previewResult.supported : undefined,
          looksLikePdf
        })
      });
    }

    stage = "build_response";
    recordStage(stage, { success: true });
    return safeJsonResponse(
      JSON.parse(JSON.stringify({
        success: true,
        ...safePreviewResult()
      }))
    );
  } catch (error) {
    console.error("imports preview failed", {
      stage,
      error,
      stack: error instanceof Error ? error.stack : null
    });
    const message = resolveFunctionalPreviewMessage({
      stage,
      errorMessage: error instanceof Error ? error.message : undefined
    });
    return jsonPreviewError(
      message,
      buildDebugPayload({
        stage,
        errorMessage: error instanceof Error ? error.message : undefined,
        parser: typeof previewResult?.parser === "string" ? previewResult.parser : undefined,
        supported: typeof previewResult?.supported === "boolean" ? previewResult.supported : undefined,
        looksLikePdf
      })
    );
  }
}
