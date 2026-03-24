import { NextResponse, type NextRequest } from "next/server";
import { hasPermission, type PermissionAction } from "@/server/permissions/permissions";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";

type AuthorizedContext = {
  workspaceId: string;
  userKey: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  source: "session" | "dev-headers" | "none";
};

export async function requireRoutePermission(request: NextRequest, action: PermissionAction) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context.workspaceId || !context.userKey || !context.role) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Sesion requerida." }, { status: 401 })
    };
  }

  if (!hasPermission(context.role, action)) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Acceso no autorizado." }, { status: 403 })
    };
  }

  return {
    ok: true as const,
    context: context as AuthorizedContext
  };
}
