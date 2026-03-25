"use client";

import { ImportTransactionsPanel } from "@/components/imports/import-transactions-panel";
import { PageContainer } from "@/components/ui/page-container";
import { SectionHeader } from "@/components/ui/section-header";
import { StatPill } from "@/components/ui/stat-pill";

export function ImportacionesClient() {
  return (
    <PageContainer className="space-y-6">
      <SectionHeader
        eyebrow="Importaciones"
        title="Subir cartolas"
        description="Importa movimientos desde CSV, Excel o PDF y revisa antes de guardar."
        actions={<StatPill tone="premium">Vista previa real</StatPill>}
      />
      <ImportTransactionsPanel />
    </PageContainer>
  );
}

