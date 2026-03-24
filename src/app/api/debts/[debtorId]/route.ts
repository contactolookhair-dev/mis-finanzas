import { DebtorStatus } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const updateDebtorSchema = z.object({
  name: z.string().min(3).optional(),
  reason: z.string().min(3).optional(),
  totalAmount: z.coerce.number().positive().optional(),
  status: z.nativeEnum(DebtorStatus).optional(),
  estimatedPayDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { debtorId: string } }
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
    const payload = updateDebtorSchema.parse((await request.json()) as unknown);
    const existing = await prisma.debtor.findFirst({
      where: {
        id: params.debtorId,
        workspaceId: context.workspaceId
      }
    });

    if (!existing) {
      return NextResponse.json({ message: "Deuda no encontrada." }, { status: 404 });
    }

    await prisma.debtor.update({
      where: { id: existing.id },
      data: {
        name: payload.name,
        reason: payload.reason,
        totalAmount: payload.totalAmount,
        status: payload.status,
        estimatedPayDate: payload.estimatedPayDate
          ? new Date(`${payload.estimatedPayDate}T12:00:00`)
          : payload.estimatedPayDate === null
            ? null
            : undefined,
        notes: payload.notes
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Datos inválidos para editar deuda.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "No se pudo editar la deuda." }, { status: 500 });
  }
}
