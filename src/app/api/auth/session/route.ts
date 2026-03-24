import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getAuthSessionFromRequest } from "@/server/auth/session";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { hasPermission } from "@/server/permissions/permissions";

export async function GET(request: NextRequest) {
  const session = await getAuthSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      {
        authenticated: false
      },
      { status: 401 }
    );
  }

  const context = await getWorkspaceContextFromRequest(request);
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userKey: session.userKey,
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
      userKey: session.userKey,
      displayName: session.displayName
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
