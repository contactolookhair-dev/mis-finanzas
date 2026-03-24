import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SectionHeader } from "@/components/ui/section-header";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Resumen general"
        title="Dashboard financiero"
        description="Vista principal conectada a datos reales del workspace activo, con filtros funcionales y una experiencia premium para iPhone y MacBook."
      />

      <DashboardClient />
    </div>
  );
}

