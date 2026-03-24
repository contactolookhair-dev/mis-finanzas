import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import {
  buildSessionCookieOptions,
  createAuthSession,
  SESSION_COOKIE_NAME
} from "@/server/auth/session";

const devLoginSchema = z.object({
  userKey: z.string().min(3),
  displayName: z.string().optional(),
  workspaceSlug: z.string().optional()
});

export async function POST(request: NextRequest) {
  const allowDevLogin =
    process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_AUTH_LOGIN === "true";

  if (!allowDevLogin) {
    return NextResponse.json({ message: "Dev login deshabilitado." }, { status: 403 });
  }

  try {
    const json = await request.json();
    const payload = devLoginSchema.parse(json);

    const workspace =
      payload.workspaceSlug
        ? await prisma.workspace.findFirst({
            where: { slug: payload.workspaceSlug, isActive: true }
          })
        : await prisma.workspace.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: "asc" }
          });

    if (!workspace) {
      return NextResponse.json({ message: "No existe workspace disponible." }, { status: 400 });
    }

    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userKey: {
          workspaceId: workspace.id,
          userKey: payload.userKey
        }
      },
      update: {
        isActive: true
      },
      create: {
        workspaceId: workspace.id,
        userKey: payload.userKey,
        role: "OWNER",
        isActive: true
      }
    });

    const session = await createAuthSession({
      userKey: payload.userKey,
      displayName: payload.displayName,
      activeWorkspaceId: workspace.id
    });

    const response = NextResponse.json({
      message: "Sesion creada.",
      workspaceId: workspace.id
    });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      session.token,
      buildSessionCookieOptions(session.expiresAt)
    );
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalido para login.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo crear sesion." }, { status: 500 });
  }
}
