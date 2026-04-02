import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { addLoanPayment } from "@/server/services/loans-service";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const createPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paidAt: z.string().min(1),
  notes: z.string().optional().nullable()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { loanId: string } }
) {
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
    const input = createPaymentSchema.parse((await request.json()) as unknown);
    await addLoanPayment({
      workspaceId: context.workspaceId,
      loanId: params.loanId,
      amount: input.amount,
      paidAt: new Date(`${input.paidAt}T12:00:00`),
      notes: input.notes ?? null
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Datos inválidos para registrar abono.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo registrar el abono." }, { status: 500 });
  }
}

