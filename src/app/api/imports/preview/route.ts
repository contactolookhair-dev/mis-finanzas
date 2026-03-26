import { NextResponse, type NextRequest } from "next/server";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { previewImportFile } from "@/server/services/import-service";

function normalizeOptionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : undefined;
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

export async function POST(request: NextRequest) {
  const access = await requireRoutePermission(request, "transactions:import");
  if (!access.ok) {
    return access.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const selectedTemplateId = formData.get("templateId");
    const importType = normalizeOptionalString(formData.get("type"));
    const preferredAccountId = normalizeOptionalString(formData.get("accountId"));

    console.log("imports preview received", {
      workspaceId: access.context.workspaceId,
      fileName: file instanceof File ? file.name : null,
      mimeType: file instanceof File ? file.type : null,
      importType,
      preferredAccountId,
      selectedTemplateId: normalizeOptionalString(selectedTemplateId)
    });

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Debes adjuntar un archivo." }, { status: 400 });
    }

    if (importType && importType !== "account" && importType !== "credit") {
      return NextResponse.json(
        { message: "Tipo de importación inválido." },
        { status: 400 }
      );
    }

    if (
      preferredAccountId &&
      (preferredAccountId.includes("...") ||
        preferredAccountId.includes("…") ||
        preferredAccountId.length < 8)
    ) {
      console.warn("imports preview invalid accountId", { preferredAccountId });
      return NextResponse.json(
        { message: "La cuenta seleccionada no es válida. Revisa la tarjeta elegida e inténtalo nuevamente." },
        { status: 400 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const preview = await previewImportFile({
      workspaceId: access.context.workspaceId,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      selectedTemplateId: typeof selectedTemplateId === "string" ? selectedTemplateId : undefined,
      preferredAccountId,
      preferredImportType: importType === "credit" || importType === "account" ? importType : undefined
    });

    return NextResponse.json(preview);
  } catch (error) {
    console.error("imports preview failed", {
      error,
      message: error instanceof Error ? error.message : "unknown"
    });

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? getFriendlyPreviewError(error.message)
            : "No pudimos leer este PDF con la configuración actual. Intenta nuevamente o revisa la cuenta seleccionada."
      },
      { status: 500 }
    );
  }
}
