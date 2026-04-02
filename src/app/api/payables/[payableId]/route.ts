import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { extractOwnerDebtMarkerFromNotes } from "@/server/repositories/payable-repository";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const updatePayableSchema = z.object({
  origin: z.string().min(2).optional(),
  amount: z.coerce.number().positive().optional(),
  dueDate: z.string().min(1).optional(),
  paidAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { payableId: string } }
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
    const payload = updatePayableSchema.parse((await request.json()) as unknown);
    const existing = await prisma.payable.findFirst({
      where: {
        id: params.payableId,
        workspaceId: context.workspaceId
      }
    });

    if (!existing) {
      return NextResponse.json({ message: "Pendiente no encontrado." }, { status: 404 });
    }

    const ownerDebtMarker = extractOwnerDebtMarkerFromNotes(existing.notes);
    const nextNotes = (() => {
      if (payload.notes === undefined) return undefined;
      if (!ownerDebtMarker) return payload.notes;
      const userNotes = typeof payload.notes === "string" ? payload.notes.trim() : "";
      return userNotes ? `${ownerDebtMarker} · ${userNotes}` : ownerDebtMarker;
    })();

    await prisma.payable.update({
      where: { id: existing.id },
      data: {
        origin: payload.origin ? payload.origin.trim() : undefined,
        amount: payload.amount,
        dueDate: payload.dueDate ? new Date(`${payload.dueDate}T12:00:00`) : undefined,
        paidAt: payload.paidAt
          ? new Date(`${payload.paidAt}T12:00:00`)
          : payload.paidAt === null
            ? null
            : undefined,
        notes: nextNotes
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Datos inválidos para editar pendiente.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo editar el pendiente." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { payableId: string } }
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
    const existing = await prisma.payable.findFirst({
      where: {
        id: params.payableId,
        workspaceId: context.workspaceId
      }
    });

    if (!existing) {
      return NextResponse.json({ message: "Pendiente no encontrado." }, { status: 404 });
    }

    await prisma.payable.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "No se pudo eliminar el pendiente." }, { status: 500 });
  }
}
