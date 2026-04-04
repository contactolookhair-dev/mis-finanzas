import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/nextauth-options";
import { hasPermission, type PermissionAction } from "@/server/permissions/permissions";
import { ensurePersonalWorkspaceForUser } from "@/server/tenant/ensure-personal-workspace-for-user";

export type AuthContext = {
  userKey: string;
  workspaceId: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
};

export const ACTIVE_WORKSPACE_COOKIE = "mf_active_workspace_id";

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
  const session = await getServerSession(authOptions);
  const userKey = session?.user?.id;
  if (!userKey) return null;

  const activeWorkspaceId = request.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;

  const membership = await resolveWorkspaceMembership({
    userKey,
    activeWorkspaceId
  });
  if (!membership) {
    // Create/claim workspace lazily if needed.
    await ensurePersonalWorkspaceForUser({
      userKey,
      displayName: session?.user?.name ?? session?.user?.email ?? null
    });

    const after = await resolveWorkspaceMembership({
      userKey,
      activeWorkspaceId
    });
    if (!after) return null;

    return {
      userKey,
      workspaceId: after.workspaceId,
      role: after.role
    } satisfies AuthContext;
  }

  return {
    userKey,
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
