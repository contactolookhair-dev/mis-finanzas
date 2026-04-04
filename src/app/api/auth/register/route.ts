import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authPrisma } from "@/server/db/auth-prisma";
import { ensurePersonalWorkspaceForUser } from "@/server/tenant/ensure-personal-workspace-for-user";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(120).optional()
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const payload = registerSchema.parse(json);

    const email = payload.email.trim().toLowerCase();
    const name = payload.name?.trim() ? payload.name.trim() : null;

    const existing = await authPrisma.user.findUnique({
      where: { email },
      select: { id: true }
    });
    if (existing) {
      return NextResponse.json({ message: "Este email ya está registrado." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);

    const user = await authPrisma.user.create({
      data: {
        email,
        name,
        passwordHash
      },
      select: { id: true, email: true, name: true }
    });

    await ensurePersonalWorkspaceForUser({
      userKey: user.id,
      displayName: user.name ?? user.email ?? null
    });

    return NextResponse.json({ message: "Cuenta creada.", userId: user.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Datos inválidos.", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ message: "No se pudo crear la cuenta." }, { status: 500 });
  }
}

