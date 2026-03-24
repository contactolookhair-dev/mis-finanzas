import { DeudasClient } from "@/components/deudas/deudas-client";

export default function PendientesPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tab = typeof searchParams?.tab === "string" ? searchParams.tab : undefined;
  const action = typeof searchParams?.action === "string" ? searchParams.action : undefined;
  return <DeudasClient initialTab={tab} initialAction={action} />;
}
