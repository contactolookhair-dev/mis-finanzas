import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { appConfig } from "@/lib/config/app-config";
import { SETTINGS_SECTIONS } from "@/shared/types/settings";

export function SettingsPanel() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
      <SurfaceCard variant="highlight" className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Panel autoadministrable</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Configuración pensada para operar la app sin tocar código. Todo lo que cambia con el tiempo se administra desde aquí.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {SETTINGS_SECTIONS.map((section) => (
            <div key={section.title} className="rounded-[24px] border border-white/70 bg-white/72 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-slate-900">{section.title}</p>
                <StatPill tone="premium" className="px-2.5 py-1 text-[10px]">
                  Interno
                </StatPill>
              </div>
              <p className="mt-2 text-sm text-neutral-600">{section.description}</p>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard variant="soft" className="space-y-4">
        <h3 className="text-lg font-semibold">Preferencias locales</h3>
        <div className="space-y-3 text-sm">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
            <p className="text-neutral-500">Moneda principal</p>
            <p className="font-semibold">
              {appConfig.region.currencySymbol} {appConfig.region.currencyCode}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
            <p className="text-neutral-500">Idioma</p>
            <p className="font-semibold">{appConfig.region.locale}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
            <p className="text-neutral-500">Formato de fecha</p>
            <p className="font-semibold">{appConfig.region.dateFormat}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
            <p className="text-neutral-500">Módulos activos</p>
            <p className="font-semibold">{appConfig.modules.join(", ")}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
            <p className="text-neutral-500">Endpoints internos</p>
            <p className="font-semibold">/api/settings · /api/ai/query</p>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
