import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { createAdminAuditLog } from "@/server/repositories/admin-audit-repository";
import {
  createWorkspaceImportTemplate,
  duplicateImportTemplateToWorkspace,
  listWorkspaceAwareImportTemplates
} from "@/server/services/import/import-template-service";
import {
  importTemplateDuplicatePayloadSchema,
  importTemplatePayloadSchema
} from "@/shared/types/import-templates";

export async function GET(request: NextRequest) {
  const access = await requireRoutePermission(request, "settings:view");
  if (!access.ok) {
    return access.response;
  }

  const templates = await listWorkspaceAwareImportTemplates({
    workspaceId: access.context.workspaceId,
    includeInactive: true
  });

  return NextResponse.json({ items: templates });
}

export async function POST(request: NextRequest) {
  const access = await requireRoutePermission(request, "settings:edit");
  if (!access.ok) {
    return access.response;
  }

  try {
    const json = await request.json();

    if (json && typeof json === "object" && "duplicateFromTemplateId" in json) {
      const payload = importTemplateDuplicatePayloadSchema.parse(json);
      const created = await duplicateImportTemplateToWorkspace(
        access.context.workspaceId,
        payload.duplicateFromTemplateId
      );

      await createAdminAuditLog({
        workspaceId: access.context.workspaceId,
        userKey: access.context.userKey,
        sessionId: undefined,
        section: "import_templates",
        action: "import-template.duplicate",
        changedFields: [
          {
            fieldPath: "template.name",
            previousValue: null,
            nextValue: created.name
          }
        ],
        afterData: created
      });

      return NextResponse.json({ message: "Plantilla duplicada.", item: created });
    }

    const payload = importTemplatePayloadSchema.parse(json);
    const created = await createWorkspaceImportTemplate(access.context.workspaceId, payload);

    await createAdminAuditLog({
      workspaceId: access.context.workspaceId,
      userKey: access.context.userKey,
      sessionId: undefined,
      section: "import_templates",
      action: "import-template.create",
      changedFields: [
        {
          fieldPath: "template.name",
          previousValue: null,
          nextValue: created.name
        }
      ],
      afterData: created
    });

    return NextResponse.json({ message: "Plantilla creada.", item: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalido para plantilla.", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "No se pudo crear la plantilla." }, { status: 500 });
  }
}
