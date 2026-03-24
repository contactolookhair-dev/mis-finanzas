import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { queryFinancialAI } from "@/server/services/ai-service";
import { requireRoutePermission } from "@/server/permissions/route-permissions";

const aiQuerySchema = z.object({
  question: z.string().min(3),
  filters: z
    .object({
      businessUnitId: z.string().optional(),
      categoryId: z.string().optional(),
      financialOrigin: z.enum(["PERSONAL", "EMPRESA"]).optional(),
      type: z.enum(["INGRESO", "EGRESO"]).optional(),
      search: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional()
    })
    .optional(),
  limit: z.number().int().min(1).max(200).optional()
});

export async function POST(request: NextRequest) {
  try {
    const access = await requireRoutePermission(request, "ai:query");
    if (!access.ok) {
      return access.response;
    }
    const context = access.context;

    const json = await request.json();
    const payload = aiQuerySchema.parse(json);
    const workspaceId = context.workspaceId;

    const response = await queryFinancialAI({
      question: payload.question,
      workspaceId,
      userKey: context.userKey,
      limit: payload.limit,
      filters: {
        workspaceId,
        businessUnitId: payload.filters?.businessUnitId,
        categoryId: payload.filters?.categoryId,
        financialOrigin: payload.filters?.financialOrigin,
        type: payload.filters?.type,
        search: payload.filters?.search,
        startDate: payload.filters?.startDate ? new Date(payload.filters.startDate) : undefined,
        endDate: payload.filters?.endDate ? new Date(payload.filters.endDate) : undefined
      }
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Payload inválido para consulta financiera IA.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: "No fue posible procesar la consulta de IA financiera."
      },
      { status: 500 }
    );
  }
}
