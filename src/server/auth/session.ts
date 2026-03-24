import { randomBytes, createHash } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

export const SESSION_COOKIE_NAME = "mf_session";
export const DEFAULT_SESSION_TTL_DAYS = 14;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRawSessionToken() {
  return randomBytes(32).toString("hex");
}

export async function createAuthSession(input: {
  userKey: string;
  displayName?: string;
  activeWorkspaceId?: string;
  ttlDays?: number;
}) {
  const token = createRawSessionToken();
  const tokenHash = hashSessionToken(token);
  const ttlDays = input.ttlDays ?? DEFAULT_SESSION_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await prisma.authSession.create({
    data: {
      sessionTokenHash: tokenHash,
      userKey: input.userKey,
      displayName: input.displayName,
      activeWorkspaceId: input.activeWorkspaceId,
      expiresAt
    }
  });

  return { token, expiresAt };
}

export async function revokeAuthSession(token: string) {
  const tokenHash = hashSessionToken(token);
  await prisma.authSession.deleteMany({
    where: { sessionTokenHash: tokenHash }
  });
}

export async function getAuthSessionFromRequest(request: NextRequest) {
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.authSession.findUnique({
    where: { sessionTokenHash: tokenHash }
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.delete({
      where: { id: session.id }
    });
    return null;
  }

  return {
    ...session,
    rawToken
  };
}

export function buildSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  };
}
