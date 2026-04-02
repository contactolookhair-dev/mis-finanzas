import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { listTransactions } from "@/server/repositories/transaction-repository";
import { createTransactionWithAutomation } from "@/server/services/transaction-service";
import { buildDuplicateFingerprint } from "@/server/services/import/import-fingerprint";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { toAmountNumber } from "@/server/lib/amounts";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const transactionsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  accountId: z.string().optional(),
  businessUnitId: z.string().optional(),
  categoryId: z.string().optional(),
  financialOrigin: z.enum(["PERSONAL", "EMPRESA"]).optional(),
  reviewStatus: z.enum(["PENDIENTE", "REVISADO", "OBSERVADO"]).optional(),
  search: z.string().optional(),
  type: z.enum(["INGRESO", "EGRESO"]).optional(),
  cursor: z.string().optional()
});

const createTransactionSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(3),
  amount: z.coerce.number().positive(),
  type: z.enum(["INGRESO", "EGRESO"]).default("EGRESO"),
  financialOrigin: z.enum(["PERSONAL", "EMPRESA"]).default("PERSONAL"),
  accountId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  subcategoryId: z.string().optional().nullable(),
  businessUnitId: z.string().optional().nullable(),
  notes: z.string().optional(),
  isReimbursable: z.boolean().optional().default(false),
  isBusinessPaidPersonally: z.boolean().optional().default(false),
  reviewStatus: z.enum(["PENDIENTE", "REVISADO", "OBSERVADO"]).optional().default("PENDIENTE"),
  creditImpactType: z
    .enum(["consume_cupo", "no_consume_cupo", "pago_tarjeta", "ajuste_manual"])
    .optional()
    .default("consume_cupo"),
  // Credit card purchases: installments are a separate dimension from classification (personal/negocio/prestado).
  isInstallmentPurchase: z.boolean().optional().default(false),
  cuotaActual: z.coerce.number().int().positive().nullable().optional(),
  cuotaTotal: z.coerce.number().int().positive().nullable().optional(),
  owed: z
    .object({
      isOwed: z.boolean(),
      byType: z.enum(["PERSONA", "EMPRESA"]),
      amount: z.coerce.number().positive().optional().nullable(),
      debtorId: z.string().optional().nullable(),
      debtorName: z.string().optional().nullable(),
      businessUnitId: z.string().optional().nullable()
    })
    .optional()
    .nullable()
});

function toStartDate(value?: string) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function toEndDate(value?: string) {
  return value ? new Date(`${value}T23:59:59.999`) : undefined;
}

function extractCreditCardInstallments(metadata: unknown) {
  const raw = metadata as any;
  const source = raw?.manual?.creditCardMeta ?? raw?.import?.creditCardMeta ?? null;
  if (!source) return null;

  const isInstallmentPurchase = source.esCompraEnCuotas === true || source.isInstallmentPurchase === true;
  if (!isInstallmentPurchase) return null;

  const cuotaActual =
    typeof source.cuotaActual === "number"
      ? source.cuotaActual
      : typeof source.currentInstallment === "number"
        ? source.currentInstallment
        : null;
  const cuotaTotal =
    typeof source.cuotaTotal === "number"
      ? source.cuotaTotal
      : typeof source.totalInstallments === "number"
        ? source.totalInstallments
        : null;
  const cuotasRestantes =
    typeof source.cuotasRestantes === "number"
      ? source.cuotasRestantes
      : typeof source.remainingInstallments === "number"
        ? source.remainingInstallments
        : typeof cuotaActual === "number" && typeof cuotaTotal === "number"
          ? Math.max(0, cuotaTotal - cuotaActual)
          : null;
  const installmentLabelRaw = typeof source.installmentLabelRaw === "string" ? source.installmentLabelRaw : null;

  return {
    isInstallmentPurchase: true,
    cuotaActual,
    cuotaTotal,
    cuotasRestantes,
    installmentLabelRaw
  };
}

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json({ items: [], pageInfo: { nextCursor: null, hasMore: false } });
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const takeParam = request.nextUrl.searchParams.get("take");
    const parsedTake = takeParam ? Number.parseInt(takeParam, 10) : NaN;
    const safeTake =
      Number.isFinite(parsedTake) && parsedTake > 0 ? Math.min(parsedTake, 500) : undefined;

    const query = transactionsQuerySchema.parse({
      startDate: request.nextUrl.searchParams.get("startDate") ?? undefined,
      endDate: request.nextUrl.searchParams.get("endDate") ?? undefined,
      accountId: request.nextUrl.searchParams.get("accountId") ?? undefined,
      businessUnitId: request.nextUrl.searchParams.get("businessUnitId") ?? undefined,
      categoryId: request.nextUrl.searchParams.get("categoryId") ?? undefined,
      financialOrigin: request.nextUrl.searchParams.get("financialOrigin") ?? undefined,
      reviewStatus: request.nextUrl.searchParams.get("reviewStatus") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      type: request.nextUrl.searchParams.get("type") ?? undefined,
      cursor: request.nextUrl.searchParams.get("cursor") ?? undefined
    });

    const result = await listTransactions({
      workspaceId: context.workspaceId,
      startDate: toStartDate(query.startDate),
      endDate: toEndDate(query.endDate),
      accountId: query.accountId,
      businessUnitId: query.businessUnitId,
      categoryId: query.categoryId,
      financialOrigin: query.financialOrigin,
      type: query.type,
      reviewStatus: query.reviewStatus,
      search: query.search,
      take: safeTake ?? 50,
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
        accountId: item.accountId,
        categoryId: item.categoryId,
        creditImpactType: item.creditImpactType,
        notes: item.notes ?? null,
        account: item.account?.name ?? "Sin cuenta",
        category: item.category?.name ?? "Sin categoria",
        businessUnit: item.businessUnit?.name ?? "Sin asignar",
        origin: item.financialOrigin,
        reimbursable: item.isReimbursable,
        reviewStatus: item.reviewStatus,
        ...(extractCreditCardInstallments(item.metadata) ?? {})
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

export async function POST(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json(
      { message: "No se pudo resolver el contexto de trabajo." },
      { status: 400 }
    );
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const rawBody = (await request.json()) as unknown;
    const input = createTransactionSchema.parse(rawBody);
    const date = new Date(`${input.date}T12:00:00`);
    const normalizedAmount = input.type === "EGRESO" ? -Math.abs(input.amount) : Math.abs(input.amount);
    const duplicateFingerprint = buildDuplicateFingerprint({
      date,
      amount: normalizedAmount,
      description: input.description
    });

    const manualMeta: Record<string, unknown> = {};
    if (input.isInstallmentPurchase) {
      manualMeta.creditCardMeta = {
        esCompraEnCuotas: true,
        cuotaActual: typeof input.cuotaActual === "number" ? input.cuotaActual : null,
        cuotaTotal: typeof input.cuotaTotal === "number" ? input.cuotaTotal : null,
        cuotasRestantes:
          typeof input.cuotaActual === "number" && typeof input.cuotaTotal === "number"
            ? Math.max(0, input.cuotaTotal - input.cuotaActual)
            : null,
        installmentLabelRaw:
          typeof input.cuotaActual === "number" && typeof input.cuotaTotal === "number"
            ? `${input.cuotaActual}/${input.cuotaTotal}`
            : "en cuotas",
        installmentAmount: Math.abs(input.amount)
      };
    }
    if (input.owed?.isOwed) {
      manualMeta.owed = {
        isOwed: true,
        byType: input.owed.byType,
        amount: typeof input.owed.amount === "number" && Number.isFinite(input.owed.amount) ? input.owed.amount : null,
        debtorId: input.owed.debtorId ?? null,
        debtorName: input.owed.debtorName ?? null,
        businessUnitId: input.owed.businessUnitId ?? null
      };
    }
    // Prisma JSON types are strict; cast our structured meta to a JsonObject-compatible value.
    const metadata =
      Object.keys(manualMeta).length > 0
        ? ({ manual: manualMeta } as unknown as Prisma.InputJsonValue)
        : undefined;

    const created = await createTransactionWithAutomation({
      workspaceId: context.workspaceId,
      date,
      description: input.description,
      amount: normalizedAmount,
      type: input.type,
      financialOrigin: input.financialOrigin,
      accountId: input.accountId ?? null,
      categoryId: input.categoryId ?? null,
      subcategoryId: input.subcategoryId ?? null,
      businessUnitId: input.businessUnitId ?? null,
      notes: input.notes,
      isReimbursable: input.isReimbursable,
      isBusinessPaidPersonally: input.isBusinessPaidPersonally,
      reviewStatus: input.reviewStatus,
      creditImpactType: input.creditImpactType,
      duplicateFingerprint,
      ...(metadata ? { metadata } : {})
    });

    return NextResponse.json({
      item: {
        id: created.id,
        date: created.date.toISOString(),
        description: created.description,
        amount: toAmountNumber(created.amount)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Datos invalidos para registrar gasto.", issues: error.issues },
        { status: 400 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Este movimiento ya existe y no se guardó duplicado." },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: "No se pudo registrar el gasto." }, { status: 500 });
  }
}
