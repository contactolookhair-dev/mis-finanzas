import { NextResponse, type NextRequest } from "next/server";
import { hasPermission, type PermissionAction } from "@/server/permissions/permissions";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { isPublicMode } from "@/server/auth/public-mode";

type AuthorizedContext = {
  workspaceId: string;
  userKey: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  source: "session" | "dev-headers" | "dev-auth-bypass" | "public" | "none";
};

export async function requireRoutePermission(request: NextRequest, action: PermissionAction) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context.workspaceId || !context.userKey || !context.role) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { message: isPublicMode() ? "Modo prueba no disponible." : "Sesion requerida." },
        { status: 401 }
      )
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
