import { PendientesClient } from "@/components/pendientes/pendientes-client";

export default function PendientesPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tab = typeof searchParams?.tab === "string" ? searchParams.tab : undefined;
  return <PendientesClient initialTab={tab} />;
}
