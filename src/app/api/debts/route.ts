import { DebtorStatus } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getDebtsSnapshot } from "@/server/services/debts-service";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const createDebtorSchema = z.object({
  name: z.string().min(3),
  reason: z.string().min(3),
  totalAmount: z.coerce.number().positive(),
  startDate: z.string().min(1),
  estimatedPayDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json({
      companies: [],
      people: [],
      totals: {
        pendingCompanies: 0,
        pendingPeople: 0,
        pendingTotal: 0,
        collectedTotal: 0
      }
    });
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const snapshot = await getDebtsSnapshot(context.workspaceId);
    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json({ message: "No se pudieron cargar las deudas." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json(
      { message: "Modo prueba activo sin workspace configurado." },
      { status: 400 }
    );
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as unknown;
    const input = createDebtorSchema.parse(body);
    const totalAmount = input.totalAmount;

    const created = await prisma.debtor.create({
      data: {
        workspaceId: context.workspaceId,
        name: input.name,
        reason: input.reason,
        totalAmount,
        paidAmount: 0,
        startDate: new Date(`${input.startDate}T12:00:00`),
        estimatedPayDate: input.estimatedPayDate ? new Date(`${input.estimatedPayDate}T12:00:00`) : null,
        status: DebtorStatus.PENDIENTE,
        notes: input.notes ?? null
      }
    });

    return NextResponse.json({ id: created.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Datos inválidos para registrar deuda.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "No se pudo registrar la deuda." }, { status: 500 });
  }
}
