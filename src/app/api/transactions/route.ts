import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { listTransactions } from "@/server/repositories/transaction-repository";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { toAmountNumber } from "@/server/lib/amounts";

const transactionsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  businessUnitId: z.string().optional(),
  categoryId: z.string().optional(),
  financialOrigin: z.enum(["PERSONAL", "EMPRESA"]).optional(),
  reviewStatus: z.enum(["PENDIENTE", "REVISADO", "OBSERVADO"]).optional(),
  search: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional()
});

function toStartDate(value?: string) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function toEndDate(value?: string) {
  return value ? new Date(`${value}T23:59:59.999`) : undefined;
}

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId || !context.userKey) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const query = transactionsQuerySchema.parse({
      startDate: request.nextUrl.searchParams.get("startDate") ?? undefined,
      endDate: request.nextUrl.searchParams.get("endDate") ?? undefined,
      businessUnitId: request.nextUrl.searchParams.get("businessUnitId") ?? undefined,
      categoryId: request.nextUrl.searchParams.get("categoryId") ?? undefined,
      financialOrigin: request.nextUrl.searchParams.get("financialOrigin") ?? undefined,
      reviewStatus: request.nextUrl.searchParams.get("reviewStatus") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      take: request.nextUrl.searchParams.get("take") ?? undefined,
      cursor: request.nextUrl.searchParams.get("cursor") ?? undefined
    });

    const result = await listTransactions({
      workspaceId: context.workspaceId,
      startDate: toStartDate(query.startDate),
      endDate: toEndDate(query.endDate),
      businessUnitId: query.businessUnitId,
      categoryId: query.categoryId,
      financialOrigin: query.financialOrigin,
      reviewStatus: query.reviewStatus,
      search: query.search,
      take: query.take ?? 50,
      cursor: query.cursor,
      order: {
        field: "date",
        direction: "desc"
      }
    });

    return NextResponse.json({
      items: result.items.map((item) => ({
        id: item.id,
        date: item.date.toISOString(),
        description: item.description,
        amount: toAmountNumber(item.amount),
        type: item.type,
        account: item.account?.name ?? "Sin cuenta",
        category: item.category?.name ?? "Sin categoria",
        businessUnit: item.businessUnit?.name ?? "Sin asignar",
        origin: item.financialOrigin,
        reimbursable: item.isReimbursable,
        reviewStatus: item.reviewStatus
      })),
      pageInfo: result.pageInfo
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Parámetros inválidos para listar movimientos.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "No se pudieron cargar los movimientos." },
      { status: 500 }
    );
  }
}
