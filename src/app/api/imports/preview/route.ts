import { NextResponse, type NextRequest } from "next/server";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { previewImportFile } from "@/server/services/import-service";

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
  if (!message) {
    return "No pudimos leer este PDF. Verifica el archivo o intenta nuevamente.";
  }

  if (
    message.includes("did not match the expected pattern") ||
    message.includes("expected pattern")
  ) {
    return "No pudimos leer este PDF. Verifica el archivo o intenta nuevamente.";
  }

  return "No pudimos leer este PDF. Verifica el archivo o intenta nuevamente.";
}

export async function POST(request: NextRequest) {
  const access = await requireRoutePermission(request, "transactions:import");
  if (!access.ok) {
    return access.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const selectedTemplateId = formData.get("templateId");
    const importTypeRaw = normalizeOptionalString(formData.get("type"));
    const importType = normalizeImportType(importTypeRaw);
    const preferredAccountId = normalizeOptionalString(formData.get("accountId"));

    console.log("imports preview received", {
      workspaceId: access.context.workspaceId,
      fileName: file instanceof File ? file.name : null,
      mimeType: file instanceof File ? file.type : null,
      importTypeRaw,
      importType,
      preferredAccountId,
      fileSize: file instanceof File ? file.size : null,
      selectedTemplateId: normalizeOptionalString(selectedTemplateId)
    });

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "preview_failed",
          message: "No pudimos leer este PDF. Verifica el archivo o intenta nuevamente."
        },
        { status: 200 }
      );
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
      workspaceId: access.context.workspaceId,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      selectedTemplateId: typeof selectedTemplateId === "string" ? selectedTemplateId : undefined,
      preferredAccountId,
      preferredImportType: importType
    });

    return NextResponse.json({
      success: true,
      ...preview
    });
  } catch (error) {
    console.error("imports preview failed", {
      error,
      message: error instanceof Error ? error.message : "unknown"
    });

    return NextResponse.json(
      {
        success: false,
        error: "preview_failed",
        message: error instanceof Error ? getFriendlyPreviewError(error.message) : getFriendlyPreviewError()
      },
      { status: 200 }
    );
  }
}
