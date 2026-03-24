import type { NextRequest } from "next/server";
import { getAuthContextOrNull } from "@/server/auth/auth-context";
import { isPublicMode } from "@/server/auth/public-mode";
import { prisma } from "@/server/db/prisma";

export type WorkspaceContext = {
  workspaceId?: string;
  userKey?: string;
  role?: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  source: "session" | "dev-headers" | "public" | "none";
};

export async function getWorkspaceContextFromRequest(request: NextRequest): Promise<WorkspaceContext> {
  const auth = await getAuthContextOrNull(request);
  if (auth) {
    return {
      workspaceId: auth.workspaceId,
      userKey: auth.userKey,
      role: auth.role,
      source: "session"
    };
  }

  const allowDevHeaders =
    process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_TENANT_HEADERS === "true";

  if (allowDevHeaders) {
    const workspaceId = request.headers.get("x-workspace-id") ?? undefined;
    const userKey = request.headers.get("x-user-key") ?? undefined;
    if (workspaceId && userKey) {
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userKey,
          isActive: true
        }
      });
      if (!membership) {
        return { source: "none" };
      }

      return {
        workspaceId: membership.workspaceId,
        userKey: membership.userKey,
        role: membership.role,
        source: "dev-headers"
      };
    }
  }

  if (isPublicMode()) {
    const workspace = await prisma.workspace.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" }
    });

    if (workspace) {
      return {
        workspaceId: workspace.id,
        userKey: "public",
        role: "OWNER",
        source: "public"
      };
    }
  }

  return {
    source: "none"
  };
}
