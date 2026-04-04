import { Suspense } from "react";
import ResetPasswordClient from "./reset-password-client";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage({
  searchParams
}: {
  searchParams: { token?: string };
}) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";

  return (
    <Suspense fallback={<div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-lg items-center px-4 py-10" />}>
      <ResetPasswordClient token={token} />
    </Suspense>
  );
}

