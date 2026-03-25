"use client";

import { ErrorStateCard } from "@/components/ui/states";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="pb-20">
      <ErrorStateCard
        title="Algo salió mal"
        description={error.message || "Ocurrió un problema cargando esta sección."}
        onRetry={reset}
      />
    </div>
  );
}
