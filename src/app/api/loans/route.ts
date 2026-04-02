import { NextResponse, type NextRequest } from "next/server";
import { LoanCounterpartyType, LoanInterestType, LoanType } from "@prisma/client";
import { z } from "zod";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { createLoan, listLoans } from "@/server/services/loans-service";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const emptyToNull = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD).");

const createLoanSchema = z.object({
  loanType: z.enum(["lent", "borrowed"]),
  counterpartyType: z.enum(["person", "company", "custom"]),
  counterpartyName: z.string().min(2),
  amountTotal: z.coerce.number().positive(),
  startDate: ymdSchema,
  dueDate: z.preprocess(emptyToNull, ymdSchema.optional().nullable()),
  description: z.preprocess(emptyToNull, z.string().optional().nullable()),
  businessUnitId: z.preprocess(emptyToNull, z.string().optional().nullable()),
  sourceAccountId: z.preprocess(emptyToNull, z.string().optional().nullable()),
  hasInterest: z.coerce.boolean().optional(),
  interestType: z.preprocess(
    emptyToNull,
    z.enum(["FIXED", "MONTHLY_PERCENT", "ANNUAL_PERCENT"]).optional().nullable()
  ),
  interestValue: z.coerce.number().optional().nullable()
});

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json({ items: [] });
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const loanTypeParam = request.nextUrl.searchParams.get("loanType");
  const loanType =
    loanTypeParam === "lent"
      ? LoanType.LENT
      : loanTypeParam === "borrowed"
        ? LoanType.BORROWED
        : undefined;

  const items = await listLoans(context.workspaceId, loanType);
  return NextResponse.json({ items });
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
    const input = createLoanSchema.parse((await request.json()) as unknown);
    const loan = await createLoan({
      workspaceId: context.workspaceId,
      loanType: input.loanType === "lent" ? LoanType.LENT : LoanType.BORROWED,
      counterpartyType:
        input.counterpartyType === "person"
          ? LoanCounterpartyType.PERSON
          : input.counterpartyType === "company"
            ? LoanCounterpartyType.COMPANY
            : LoanCounterpartyType.CUSTOM,
      counterpartyName: input.counterpartyName,
      businessUnitId: input.businessUnitId ?? null,
      sourceAccountId: input.sourceAccountId ?? null,
      amountTotal: input.amountTotal,
      startDate: new Date(`${input.startDate}T12:00:00`),
      dueDate: input.dueDate ? new Date(`${input.dueDate}T12:00:00`) : null,
      description: input.description ?? null,
      hasInterest: input.hasInterest ?? false,
      interestType: (input.interestType as LoanInterestType | null) ?? null,
      interestValue: input.interestValue ?? null
    });

    return NextResponse.json({ id: loan.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Datos inválidos para crear préstamo.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo crear el préstamo." }, { status: 500 });
  }
}
