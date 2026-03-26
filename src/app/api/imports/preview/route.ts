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

export async function POST(request: Request) {
  try {
    const [{ getWorkspaceContextFromRequest }, { hasPermission }, { previewImportFile }] = await Promise.all([
      import("@/server/tenant/workspace-context"),
      import("@/server/permissions/permissions"),
      import("@/server/services/import-service")
    ]);

    const context = await getWorkspaceContextFromRequest(request as never);
    if (!context.workspaceId || !context.userKey || !context.role) {
      console.warn("imports preview auth context missing");
      return jsonPreviewError();
    }
    if (!hasPermission(context.role, "transactions:import")) {
      console.warn("imports preview permission denied", { role: context.role });
      return jsonPreviewError();
    }

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

    const bytes = new Uint8Array(await file.arrayBuffer());
    console.log("imports preview parsing", {
      fileName: file.name,
      fileSize: bytes.byteLength,
      importType,
      preferredAccountId
    });

    const preview = await previewImportFile({
      workspaceId: context.workspaceId,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      selectedTemplateId: typeof selectedTemplateId === "string" ? selectedTemplateId : undefined,
      preferredAccountId,
      preferredImportType: importType
    });

    return Response.json({
      success: true,
      ...preview
    });
  } catch (error) {
    console.error("imports preview failed", {
      error,
      message: error instanceof Error ? error.message : "unknown"
    });
    return jsonPreviewError(error instanceof Error ? error.message : undefined);
  }
}
