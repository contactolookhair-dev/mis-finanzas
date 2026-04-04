import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/nextauth-options";
import { isPublicMode } from "@/server/auth/public-mode";
import { AuthSessionProvider } from "@/components/auth/auth-session-provider";

export default async function ProtectedLayout({
  children
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!isPublicMode()) {
    if (!session?.user?.id) {
      redirect("/login");
    }
  }

  return (
    <AuthSessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </AuthSessionProvider>
  );
}
