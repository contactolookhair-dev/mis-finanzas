import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { Resend } from "resend";
import { authPrisma } from "@/server/db/auth-prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email()
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getBaseUrl(request: NextRequest) {
  const envUrl = process.env.NEXTAUTH_URL || process.env.APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function buildHtmlEmail({ resetUrl }: { resetUrl: string }) {
  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: #f8fafc; padding: 24px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
      <div style="padding: 18px 20px; background: linear-gradient(90deg, rgba(15,23,42,0.92), rgba(59,130,246,0.88)); color: #fff;">
        <div style="font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.9;">Mis Finanzas</div>
        <div style="font-size: 18px; font-weight: 700; margin-top: 6px;">Restablecer tu contraseña</div>
      </div>
      <div style="padding: 20px;">
        <p style="margin: 0; color: #0f172a; font-size: 14px; line-height: 1.6;">
          Recibimos una solicitud para restablecer tu contraseña. Si fuiste tú, haz clic en el botón:
        </p>
        <div style="margin-top: 16px;">
          <a href="${resetUrl}" style="display: inline-block; background: #0f172a; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 999px; font-weight: 700; font-size: 14px;">
            Restablecer contraseña
          </a>
        </div>
        <p style="margin: 16px 0 0; color: #475569; font-size: 12.5px; line-height: 1.6;">
          Este link expira en 1 hora. Si no solicitaste esto, puedes ignorar este correo.
        </p>
        <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; line-height: 1.6;">
          Si el botón no funciona, copia y pega este link:<br />
          <span style="word-break: break-all; color: #0f172a;">${resetUrl}</span>
        </div>
      </div>
    </div>
  </div>
  `.trim();
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const payload = schema.parse(json);
    const email = normalizeEmail(payload.email);

    console.log("[forgot-password] request received", { email });

    // Always respond 200 to avoid leaking if the email exists.
    const generic = NextResponse.json({
      message: "Si el email existe, te enviaremos un link para restablecer tu contraseña."
    });

    const user = await authPrisma.user.findUnique({
      where: { email },
      select: { id: true, email: true }
    });
    console.log("[forgot-password] user lookup", { found: !!user });
    if (!user?.email) return generic;

    console.log("[forgot-password] creating token");
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashed = tokenHash(rawToken);
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    const identifier = `password-reset:${email}`;

    await authPrisma.verificationToken.deleteMany({
      where: { identifier }
    });

    await authPrisma.verificationToken.create({
      data: {
        identifier,
        token: hashed,
        expires
      }
    });
    console.log("[forgot-password] token created");

    const resetUrl = `${getBaseUrl(request)}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const resendKey = process.env.RESEND_API_KEY ?? "";
    const from = process.env.EMAIL_FROM ?? "Mis Finanzas <no-reply@mis-finanzas.com>";
    const resend = new Resend(resendKey);

    if (!resendKey) {
      console.warn("[forgot-password] RESEND_API_KEY missing; printing reset link", {
        email,
        resetUrl,
        expires: expires.toISOString()
      });
      return generic;
    }

    console.log("[forgot-password] sending email", { email });

    try {
      const { data, error } = await resend.emails.send({
        from,
        to: email,
        subject: "Restablecer tu contraseña (Mis Finanzas)",
        html: buildHtmlEmail({ resetUrl })
      });
      if (error) {
        console.error("[forgot-password] resend error", error);
      } else {
        console.log("[forgot-password] resend success", data);
      }
    } catch (e) {
      console.error("[forgot-password] resend crash", e);
    }

    return generic;
  } catch (error) {
    console.error("[forgot-password] ERROR", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Datos inválidos.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "No se pudo procesar la solicitud." },
      { status: 500 }
    );
  }
}
