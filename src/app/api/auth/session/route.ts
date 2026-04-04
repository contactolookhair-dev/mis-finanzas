import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { hasPermission } from "@/server/permissions/permissions";
import { isPublicMode } from "@/server/auth/public-mode";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/nextauth-options";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    if (isPublicMode()) {
      const context = await getWorkspaceContextFromRequest(request);
      if (!context.workspaceId || !context.role) {
        return NextResponse.json({ authenticated: false });
      }

      const workspace = await prisma.workspace.findFirst({
        where: { id: context.workspaceId, isActive: true },
        select: { id: true, name: true, slug: true }
      });

      if (!workspace) {
        return NextResponse.json({ authenticated: false });
      }

      return NextResponse.json({
        authenticated: true,
        user: {
          userKey: context.userKey ?? "public",
          displayName: "Modo prueba"
        },
        activeWorkspace: {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          workspaceSlug: workspace.slug,
          role: context.role
        },
        permissions: {
          canViewSettings: hasPermission(context.role, "settings:view"),
          canViewAuditLog: hasPermission(context.role, "settings:audit:view"),
          canEditSettings: hasPermission(context.role, "settings:edit"),
          canEditAI: hasPermission(context.role, "settings:ai:edit"),
          canEditDashboard: hasPermission(context.role, "settings:dashboard:edit"),
          canEditModules: hasPermission(context.role, "settings:modules:edit"),
          canImportTransactions: hasPermission(context.role, "transactions:import"),
          canExportReports: hasPermission(context.role, "reports:export"),
          canQueryAI: hasPermission(context.role, "ai:query")
        },
        memberships: [
          {
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            workspaceSlug: workspace.slug,
            role: context.role
          }
        ]
      });
    }

    return NextResponse.json({ authenticated: false });
  }

  const context = await getWorkspaceContextFromRequest(request);
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userKey: session.user.id,
      isActive: true
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });
  const activeMembership =
    context.workspaceId && context.role
      ? memberships.find(
          (member) => member.workspaceId === context.workspaceId && member.role === context.role
        ) ?? null
      : null;

  return NextResponse.json({
    authenticated: true,
    user: {
      userKey: session.user.id,
      displayName: session.user.name ?? session.user.email ?? null
    },
    activeWorkspace: activeMembership
      ? {
          workspaceId: activeMembership.workspaceId,
          workspaceName: activeMembership.workspace.name,
          workspaceSlug: activeMembership.workspace.slug,
          role: activeMembership.role
        }
      : null,
    permissions: context.role
      ? {
          canViewSettings: hasPermission(context.role, "settings:view"),
          canViewAuditLog: hasPermission(context.role, "settings:audit:view"),
          canEditSettings: hasPermission(context.role, "settings:edit"),
          canEditAI: hasPermission(context.role, "settings:ai:edit"),
          canEditDashboard: hasPermission(context.role, "settings:dashboard:edit"),
          canEditModules: hasPermission(context.role, "settings:modules:edit"),
          canImportTransactions: hasPermission(context.role, "transactions:import"),
          canExportReports: hasPermission(context.role, "reports:export"),
          canQueryAI: hasPermission(context.role, "ai:query")
        }
      : null,
    memberships: memberships.map((member) => ({
      workspaceId: member.workspaceId,
      workspaceName: member.workspace.name,
      workspaceSlug: member.workspace.slug,
      role: member.role
    }))
  });
}
