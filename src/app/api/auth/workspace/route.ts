import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getAuthSessionFromRequest } from "@/server/auth/session";

const switchWorkspaceSchema = z.object({
  workspaceId: z.string().min(3)
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
    }

    const json = await request.json();
    const payload = switchWorkspaceSchema.parse(json);

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: payload.workspaceId,
        userKey: session.userKey,
        isActive: true
      }
    });
    if (!membership) {
      return NextResponse.json(
        { message: "No tienes acceso al workspace seleccionado." },
        { status: 403 }
      );
    }

    await prisma.authSession.update({
      where: { id: session.id },
      data: { activeWorkspaceId: payload.workspaceId }
    });

    return NextResponse.json({ message: "Workspace activo actualizado." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalido.", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "No se pudo actualizar el workspace." }, { status: 500 });
  }
}

