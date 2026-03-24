import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { createAdminAuditLog } from "@/server/repositories/admin-audit-repository";
import {
  deleteWorkspaceImportTemplate,
  getEditableWorkspaceImportTemplate,
  updateWorkspaceImportTemplate
} from "@/server/services/import/import-template-service";
import { importTemplatePayloadSchema } from "@/shared/types/import-templates";

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireRoutePermission(request, "settings:edit");
  if (!access.ok) {
    return access.response;
  }

  const { templateId } = await context.params;

  try {
    const previous = await getEditableWorkspaceImportTemplate(access.context.workspaceId, templateId);
    if (!previous) {
      return NextResponse.json({ message: "Plantilla no encontrada." }, { status: 404 });
    }

    const json = await request.json();
    const payload = importTemplatePayloadSchema.parse(json);
    const updated = await updateWorkspaceImportTemplate(access.context.workspaceId, templateId, payload);

    await createAdminAuditLog({
      workspaceId: access.context.workspaceId,
      userKey: access.context.userKey,
      sessionId: undefined,
      section: "import_templates",
      action: "import-template.update",
      changedFields: [
        {
          fieldPath: "template.name",
          previousValue: previous.name,
          nextValue: updated.name
        },
        {
          fieldPath: "template.isActive",
          previousValue: previous.isActive,
          nextValue: updated.isActive
        }
      ],
      beforeData: previous,
      afterData: updated
    });

    return NextResponse.json({ message: "Plantilla actualizada.", item: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalido para plantilla.", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "No se pudo actualizar la plantilla." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const access = await requireRoutePermission(request, "settings:edit");
  if (!access.ok) {
    return access.response;
  }

  const { templateId } = await context.params;

  try {
    const previous = await getEditableWorkspaceImportTemplate(access.context.workspaceId, templateId);
    if (!previous) {
      return NextResponse.json({ message: "Plantilla no encontrada." }, { status: 404 });
    }

    await deleteWorkspaceImportTemplate(access.context.workspaceId, templateId);

    await createAdminAuditLog({
      workspaceId: access.context.workspaceId,
      userKey: access.context.userKey,
      sessionId: undefined,
      section: "import_templates",
      action: "import-template.delete",
      changedFields: [
        {
          fieldPath: "template.id",
          previousValue: previous.id,
          nextValue: null
        }
      ],
      beforeData: previous
    });

    return NextResponse.json({ message: "Plantilla eliminada." });
  } catch (error) {
    return NextResponse.json({ message: "No se pudo eliminar la plantilla." }, { status: 500 });
  }
}
