import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { listClassificationRules, createClassificationRule } from "@/server/repositories/classification-rule-repository";
import { listBusinessUnits } from "@/server/repositories/business-unit-repository";
import { listCategories } from "@/server/repositories/category-repository";
import { classificationRulePayloadSchema } from "@/shared/types/classification-rules";

export async function GET(request: NextRequest) {
  const access = await requireRoutePermission(request, "settings:view");
  if (!access.ok) {
    return access.response;
  }

  const [rules, categories, businessUnits] = await Promise.all([
    listClassificationRules(access.context.workspaceId),
    listCategories(access.context.workspaceId),
    listBusinessUnits(access.context.workspaceId)
  ]);
  return NextResponse.json({
    items: rules,
    references: {
      categories: categories.map((item) => ({ id: item.id, name: item.name })),
      businessUnits: businessUnits.map((item) => ({ id: item.id, name: item.name }))
    }
  });
}

export async function POST(request: NextRequest) {
  const access = await requireRoutePermission(request, "settings:edit");
  if (!access.ok) {
    return access.response;
  }

  try {
    const json = await request.json();
    const payload = classificationRulePayloadSchema.parse(json);
    const rule = await createClassificationRule(access.context.workspaceId, payload);
    return NextResponse.json({ message: "Regla creada.", item: rule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalido para regla.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo crear la regla." }, { status: 500 });
  }
}
