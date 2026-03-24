import { Card } from "@/components/ui/card";
import { appConfig } from "@/lib/config/app-config";
import { SETTINGS_SECTIONS } from "@/shared/types/settings";

export function SettingsPanel() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
      <Card className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Panel autoadministrable</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Configuración pensada para operar la app sin tocar código. Todo lo que cambia con el tiempo se administra desde aquí.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {SETTINGS_SECTIONS.map((section) => (
            <div key={section.title} className="rounded-[24px] bg-muted/70 p-4">
              <p className="font-medium">{section.title}</p>
              <p className="mt-2 text-sm text-neutral-600">{section.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-lg font-semibold">Preferencias locales</h3>
        <div className="space-y-3 text-sm">
          <div className="rounded-2xl bg-muted/70 p-4">
            <p className="text-neutral-500">Moneda principal</p>
            <p className="font-semibold">
              {appConfig.region.currencySymbol} {appConfig.region.currencyCode}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/70 p-4">
            <p className="text-neutral-500">Idioma</p>
            <p className="font-semibold">{appConfig.region.locale}</p>
          </div>
          <div className="rounded-2xl bg-muted/70 p-4">
            <p className="text-neutral-500">Formato de fecha</p>
            <p className="font-semibold">{appConfig.region.dateFormat}</p>
          </div>
          <div className="rounded-2xl bg-muted/70 p-4">
            <p className="text-neutral-500">Módulos activos</p>
            <p className="font-semibold">{appConfig.modules.join(", ")}</p>
          </div>
          <div className="rounded-2xl bg-muted/70 p-4">
            <p className="text-neutral-500">Endpoints internos</p>
            <p className="font-semibold">/api/settings · /api/ai/query</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
