import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/nextauth-options";
import { authPrisma } from "@/server/db/auth-prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v.length ? v : null))
    .nullable()
    .optional()
});

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const user = await authPrisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, image: true }
  });
  if (!user) {
    return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const json = await request.json();
    const payload = patchSchema.parse(json);

    const updated = await authPrisma.user.update({
      where: { id: userId },
      data: {
        name: payload.name ?? undefined
      },
      select: { id: true, email: true, name: true, image: true }
    });

    return NextResponse.json({
      message: "Perfil actualizado.",
      profile: {
        id: updated.id,
        email: updated.email ?? null,
        name: updated.name ?? null,
        image: updated.image ?? null
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalido.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "No se pudo actualizar el perfil." }, { status: 500 });
  }
}

