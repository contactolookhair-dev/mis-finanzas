import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { isDevAuthBypassEnabled } from "@/server/auth/public-mode";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/nextauth-options";
import { ACTIVE_WORKSPACE_COOKIE } from "@/server/auth/auth-context";

const switchWorkspaceSchema = z.object({
  workspaceId: z.string().min(3)
});

export async function PATCH(request: NextRequest) {
  try {
    const isDev = isDevAuthBypassEnabled();
    if (process.env.NODE_ENV !== "production") {
      console.log("DEV MODE:", isDev);
    }

    const session = await getServerSession(authOptions);
    const userKey = session?.user?.id ?? null;
    if (!isDev && !userKey) {
      return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
    }

    if (isDev && !userKey) {
      const context = await getWorkspaceContextFromRequest(request);
      if (!context.workspaceId) {
        return NextResponse.json(
          { message: "Modo desarrollo activo pero no hay workspace disponible." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Modo desarrollo activo. Workspace fijo aplicado.",
        workspaceId: context.workspaceId
      });
    }

    const json = await request.json();
    const payload = switchWorkspaceSchema.parse(json);
    if (!userKey) {
      return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: payload.workspaceId,
        userKey,
        isActive: true
      }
    });
    if (!membership) {
      return NextResponse.json(
        { message: "No tienes acceso al workspace seleccionado." },
        { status: 403 }
      );
    }

    const response = NextResponse.json({ message: "Workspace activo actualizado." });
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, payload.workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180
    });
    return response;
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
