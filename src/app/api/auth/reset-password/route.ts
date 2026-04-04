import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { authPrisma } from "@/server/db/auth-prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(16),
  password: z.string().min(8)
});

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const payload = schema.parse(json);

    const hashed = tokenHash(payload.token);
    const record = await authPrisma.verificationToken.findUnique({
      where: { token: hashed }
    });

    if (!record) {
      return NextResponse.json({ message: "Token inválido o expirado." }, { status: 400 });
    }
    if (!record.identifier.startsWith("password-reset:")) {
      return NextResponse.json({ message: "Token inválido o expirado." }, { status: 400 });
    }
    if (record.expires.getTime() < Date.now()) {
      await authPrisma.verificationToken.delete({
        where: { token: record.token }
      }).catch(() => {});
      return NextResponse.json({ message: "Token inválido o expirado." }, { status: 400 });
    }

    const email = record.identifier.slice("password-reset:".length).trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ message: "Token inválido o expirado." }, { status: 400 });
    }

    const user = await authPrisma.user.findUnique({
      where: { email },
      select: { id: true }
    });
    if (!user) {
      // Delete token anyway.
      await authPrisma.verificationToken.delete({ where: { token: record.token } }).catch(() => {});
      return NextResponse.json({ message: "Token inválido o expirado." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);

    await authPrisma.$transaction([
      authPrisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
      }),
      authPrisma.verificationToken.delete({
        where: { token: record.token }
      })
    ]);

    console.log("[reset-password] password updated", { userId: user.id });

    return NextResponse.json({ message: "Contraseña actualizada." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Datos inválidos.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo restablecer la contraseña." }, { status: 500 });
  }
}

