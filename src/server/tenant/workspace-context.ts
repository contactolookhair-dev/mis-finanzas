import type { NextRequest } from "next/server";
import { getAuthContextOrNull } from "@/server/auth/auth-context";
import { isDevAuthBypassEnabled, isPublicMode } from "@/server/auth/public-mode";
import { prisma } from "@/server/db/prisma";

export type WorkspaceContext = {
  workspaceId?: string;
  userKey?: string;
  role?: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  source: "forced-personal" | "session" | "dev-headers" | "dev-auth-bypass" | "public" | "none";
};

const FORCE_PERSONAL_WORKSPACE = process.env.FORCE_PERSONAL_WORKSPACE !== "false";

async function ensurePersonalWorkspace() {
  return prisma.workspace.upsert({
    where: { slug: "personal" },
    update: {
      name: "Personal",
      isActive: true
    },
    create: {
      name: "Personal",
      slug: "personal",
      isActive: true
    }
  });
}

export async function getWorkspaceContextFromRequest(request: NextRequest): Promise<WorkspaceContext> {
  if (FORCE_PERSONAL_WORKSPACE) {
    try {
      const workspace = await ensurePersonalWorkspace();
      console.log("workspace-context forced personal mode", {
        workspaceId: workspace.id,
        source: "forced-personal"
      });

      return {
        workspaceId: workspace.id,
        userKey: "dev-user",
        role: "OWNER",
        source: "forced-personal"
      };
    } catch (error) {
      console.log("workspace-context forced personal fallback", {
        source: "forced-personal",
        message: error instanceof Error ? error.message : "unknown"
      });

      return {
        workspaceId: process.env.PERSONAL_WORKSPACE_ID ?? "personal-fallback",
        userKey: "dev-user",
        role: "OWNER",
        source: "forced-personal"
      };
    }
  }

  const isDev = isDevAuthBypassEnabled();
  if (process.env.NODE_ENV !== "production") {
    console.log("DEV MODE:", isDev);
  }

  if (isDev) {
    console.log("workspace-context dev bypass active");
    const workspace = await prisma.workspace.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" }
    });

    if (workspace) {
      console.log("workspace-context resolved from dev bypass", { source: "dev-auth-bypass" });
      return {
        workspaceId: workspace.id,
        userKey: "dev-user",
        role: "OWNER",
        source: "dev-auth-bypass"
      };
    }
  }

  const auth = await getAuthContextOrNull(request);
  if (auth) {
    console.log("workspace-context resolved from session");
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
    console.log("workspace-context trying public mode");
    const workspace = await prisma.workspace.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" }
    });

    if (workspace) {
      console.log("workspace-context resolved from public mode");
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
