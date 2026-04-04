import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/nextauth-options";
import { ACTIVE_WORKSPACE_COOKIE } from "@/server/auth/auth-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80)
});

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userKey = session?.user?.id ?? null;
  if (!userKey) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const json = await request.json();
    const payload = createWorkspaceSchema.parse(json);

    const base = slugify(payload.name);
    const suffix = Math.random().toString(16).slice(2, 8);
    const slug = `${base || "workspace"}-${suffix}`;

    const workspace = await prisma.workspace.create({
      data: {
        name: payload.name.trim(),
        slug,
        isActive: true,
        members: {
          create: {
            userKey,
            role: "OWNER",
            isActive: true
          }
        }
      },
      select: { id: true, name: true, slug: true }
    });

    const response = NextResponse.json({
      message: "Workspace creado.",
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug
    });

    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalido.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "No se pudo crear el workspace." }, { status: 500 });
  }
}

