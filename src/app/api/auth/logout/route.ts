import { NextResponse, type NextRequest } from "next/server";
import { revokeAuthSession, SESSION_COOKIE_NAME } from "@/server/auth/session";

export async function POST(request: NextRequest) {
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    await revokeAuthSession(rawToken);
  }

  const response = NextResponse.json({ message: "Sesion cerrada." });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    expires: new Date(0)
  });
  return response;
}
