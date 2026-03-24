import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getAuthSessionFromRequest } from "@/server/auth/session";
import { hasPermission, type PermissionAction } from "@/server/permissions/permissions";

export type AuthContext = {
  userKey: string;
  workspaceId: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
};

async function resolveWorkspaceMembership(input: {
  userKey: string;
  activeWorkspaceId?: string | null;
}) {
  if (input.activeWorkspaceId) {
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: input.activeWorkspaceId,
        userKey: input.userKey,
        isActive: true
      }
    });
    if (membership) return membership;
  }

  return prisma.workspaceMember.findFirst({
    where: { userKey: input.userKey, isActive: true },
    orderBy: { createdAt: "asc" }
  });
}

export async function getAuthContextOrNull(request: NextRequest) {
  const session = await getAuthSessionFromRequest(request);
  if (!session) return null;

  const membership = await resolveWorkspaceMembership({
    userKey: session.userKey,
    activeWorkspaceId: session.activeWorkspaceId
  });
  if (!membership) return null;

  return {
    userKey: session.userKey,
    workspaceId: membership.workspaceId,
    role: membership.role
  } satisfies AuthContext;
}

export async function requireAuthContext(request: NextRequest) {
  const context = await getAuthContextOrNull(request);
  if (!context) {
    throw new Error("UNAUTHORIZED");
  }
  return context;
}

export function requirePermission(context: AuthContext, action: PermissionAction) {
  if (!hasPermission(context.role, action)) {
    throw new Error("FORBIDDEN");
  }
}
