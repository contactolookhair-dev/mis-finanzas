import { NextResponse, type NextRequest } from "next/server";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { previewImportFile } from "@/server/services/import-service";

export async function POST(request: NextRequest) {
  const access = await requireRoutePermission(request, "transactions:import");
  if (!access.ok) {
    return access.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const selectedTemplateId = formData.get("templateId");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Debes adjuntar un archivo." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const preview = await previewImportFile({
      workspaceId: access.context.workspaceId,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      selectedTemplateId: typeof selectedTemplateId === "string" ? selectedTemplateId : undefined
    });

    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "No se pudo generar la vista previa."
      },
      { status: 500 }
    );
  }
}
