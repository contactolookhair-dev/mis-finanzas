import { ClassificationRulesPanel } from "@/components/settings/classification-rules-panel";
import { DemoModeCard } from "@/components/settings/demo-mode-card";
import { ImportTemplatesPanel } from "@/components/settings/import-templates-panel";
import { SettingsAdminClient } from "@/components/settings/settings-admin-client";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { SettingsSectionsNav } from "@/components/settings/settings-sections-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { StatPill } from "@/components/ui/stat-pill";

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Autoadministración"
        title="Configuración"
        description="Panel diseñado para editar categorías, negocios, reglas, etiquetas y módulos desde la web sin depender de cambios de código."
        actions={<StatPill tone="premium">Panel interno</StatPill>}
      />
      <DemoModeCard />
      <SettingsSectionsNav />
      <SettingsPanel />
      <SettingsAdminClient />
      <ClassificationRulesPanel />
      <ImportTemplatesPanel />
    </div>
  );
}
