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

function jsonPreviewError(message?: string) {
  return Response.json(
    {
      success: false,
      error: "preview_failed",
      message: getFriendlyPreviewError(message)
    },
    { status: 200 }
  );
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
  try {
    stage = "load_dependencies";
    const [{ getWorkspaceContextFromRequest }, { hasPermission }, { previewImportFile }] = await Promise.all([
      import("@/server/tenant/workspace-context"),
      import("@/server/permissions/permissions"),
      import("@/server/services/import-service")
    ]);

    stage = "resolve_context";
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
    const bytes = new Uint8Array(await file.arrayBuffer());
    console.log("imports preview parsing", {
      fileName: file.name,
      fileSize: bytes.byteLength,
      importType,
      preferredAccountId
    });

    stage = "build_preview";
    const preview = await previewImportFile({
      workspaceId: context.workspaceId,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      selectedTemplateId: typeof selectedTemplateId === "string" ? selectedTemplateId : undefined,
      preferredAccountId,
      preferredImportType: importType
    });

    if (preview.parser === "pdf" && !preview.supported) {
      const message = resolveFunctionalPreviewMessage({
        stage: "unsupported_pdf",
        warnings: preview.warnings
      });
      return Response.json(
        {
          success: false,
          error: "preview_not_supported",
          message
        },
        { status: 200 }
      );
    }

    return Response.json({
      success: true,
      ...preview
    });
  } catch (error) {
    console.error("imports preview failed", {
      stage,
      error,
      message: error instanceof Error ? error.message : "unknown"
    });
    return jsonPreviewError(
      resolveFunctionalPreviewMessage({
        stage,
        errorMessage: error instanceof Error ? error.message : undefined
      })
    );
  }
}
