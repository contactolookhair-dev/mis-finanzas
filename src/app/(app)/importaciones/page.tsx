import { ImportacionesClient } from "@/components/imports/importaciones-client";

export default function ImportacionesPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const batchIdRaw = searchParams?.batchId;
  const typeRaw = searchParams?.type;
  const accountIdRaw = searchParams?.accountId;

  const batchId = typeof batchIdRaw === "string" ? batchIdRaw : undefined;
  const importType = typeof typeRaw === "string" ? typeRaw : undefined;
  const accountId = typeof accountIdRaw === "string" ? accountIdRaw : undefined;

  return <ImportacionesClient batchId={batchId} importType={importType} accountId={accountId} />;
}
