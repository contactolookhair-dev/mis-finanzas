import type { AuthSessionResponse } from "@/shared/types/auth";

export async function fetchAuthSession(): Promise<AuthSessionResponse> {
  const response = await fetch("/api/auth/session", {
    method: "GET",
    cache: "no-store"
  });

  const payload = (await response.json()) as AuthSessionResponse;
  return payload;
}

