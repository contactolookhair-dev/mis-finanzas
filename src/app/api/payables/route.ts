import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const upsertPayableSchema = z.object({
  origin: z.string().min(2),
  amount: z.coerce.number().positive(),
  dueDate: z.string().min(1),
  paidAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json({ items: [] });
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const items = await prisma.payable.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: [{ paidAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }]
    });
    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        origin: item.origin,
        amount: Number(item.amount),
        dueDate: item.dueDate.toISOString(),
        paidAt: item.paidAt?.toISOString() ?? null,
        notes: item.notes ?? null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      }))
    });
  } catch {
    return NextResponse.json({ message: "No se pudieron cargar los pagos pendientes." }, { status: 500 });
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
    const input = upsertPayableSchema.parse((await request.json()) as unknown);
    const created = await prisma.payable.create({
      data: {
        workspaceId: context.workspaceId,
        origin: input.origin.trim(),
        amount: input.amount,
        dueDate: new Date(`${input.dueDate}T12:00:00`),
        paidAt: input.paidAt ? new Date(`${input.paidAt}T12:00:00`) : null,
        notes: input.notes ?? null
      }
    });
    return NextResponse.json({ id: created.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Datos inválidos para registrar pendiente.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo registrar el pendiente." }, { status: 500 });
  }
}

