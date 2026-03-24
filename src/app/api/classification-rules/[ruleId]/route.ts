import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { updateClassificationRule } from "@/server/repositories/classification-rule-repository";
import { classificationRulePayloadSchema } from "@/shared/types/classification-rules";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  const access = await requireRoutePermission(request, "settings:edit");
  if (!access.ok) {
    return access.response;
  }

  try {
    const json = await request.json();
    const payload = classificationRulePayloadSchema.parse(json);
    const item = await updateClassificationRule(access.context.workspaceId, params.ruleId, payload);
    return NextResponse.json({ message: "Regla actualizada.", item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalido para regla.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo actualizar la regla." }, { status: 500 });
  }
}

