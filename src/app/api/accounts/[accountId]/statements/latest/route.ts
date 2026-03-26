import { NextResponse, type NextRequest } from "next/server";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { getLatestCreditCardStatement } from "@/server/services/credit-card-statement-service";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

export async function GET(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json(
      { message: "No se pudo resolver el contexto de trabajo." },
      { status: 400 }
    );
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const latest = await getLatestCreditCardStatement({
    workspaceId: context.workspaceId,
    accountId: params.accountId
  });

  return NextResponse.json({ latest });
}

