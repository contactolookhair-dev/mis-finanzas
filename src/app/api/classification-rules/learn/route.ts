import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { upsertLearnedMerchantCategoryRule } from "@/server/repositories/classification-rule-repository";

const payloadSchema = z.object({
  merchant: z.string().min(2),
  categoryId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const access = await requireRoutePermission(request, "transactions:import");
  if (!access.ok) {
    return access.response;
  }

  try {
    const json = await request.json();
    const payload = payloadSchema.parse(json);
    const rule = await upsertLearnedMerchantCategoryRule(access.context.workspaceId, payload);
    return NextResponse.json({ ok: true, item: rule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, message: "Payload inválido.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "No se pudo aprender la categoría." },
      { status: 500 }
    );
  }
}

