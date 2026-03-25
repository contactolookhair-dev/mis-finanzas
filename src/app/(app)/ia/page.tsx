import { AIQueryPanel } from "@/components/ai/ai-query-panel";
import { SectionHeader } from "@/components/ui/section-header";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { appConfig } from "@/lib/config/app-config";

export default function IAPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Asistente contextual"
        title="IA financiera"
        description="Base del módulo para consultar tus datos en lenguaje natural, siempre sobre información real de la app."
        actions={<StatPill tone="premium">Narrativa opcional</StatPill>}
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <AIQueryPanel />
          <SurfaceCard variant="soft" className="space-y-4">
            <p className="text-sm font-medium">Requisitos ya contemplados para la fase 2</p>
            <div className="mt-3 space-y-2 text-sm text-neutral-600">
              <p>Respuestas con rango de fechas explícito</p>
              <p>Sin alucinaciones: solo datos reales de la base</p>
              <p>Capacidad para devolver tablas, cards y gráficos relevantes</p>
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard variant="highlight" className="space-y-4">
          <h3 className="text-lg font-semibold">Preguntas sugeridas</h3>
          {appConfig.suggestedAiQuestions.map((question) => (
            <button
              key={question}
              className="w-full rounded-[22px] border border-white/80 bg-white/85 px-4 py-4 text-left text-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              {question}
            </button>
          ))}
        </SurfaceCard>
      </div>
    </div>
  );
}
