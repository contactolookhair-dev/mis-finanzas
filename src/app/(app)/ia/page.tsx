import { AIQueryPanel } from "@/components/ai/ai-query-panel";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { appConfig } from "@/lib/config/app-config";

export default function IAPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Asistente contextual"
        title="IA financiera"
        description="Base del módulo para consultar tus datos en lenguaje natural, siempre sobre información real de la app."
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <AIQueryPanel />
          <div className="rounded-[28px] bg-muted/70 p-5">
            <p className="text-sm font-medium">Requisitos ya contemplados para la fase 2</p>
            <div className="mt-3 space-y-2 text-sm text-neutral-600">
              <p>Respuestas con rango de fechas explícito</p>
              <p>Sin alucinaciones: solo datos reales de la base</p>
              <p>Capacidad para devolver tablas, cards y gráficos relevantes</p>
            </div>
          </div>
        </div>

        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Preguntas sugeridas</h3>
          {appConfig.suggestedAiQuestions.map((question) => (
            <button
              key={question}
              className="w-full rounded-[22px] border border-border bg-white/80 px-4 py-4 text-left text-sm transition hover:bg-white"
            >
              {question}
            </button>
          ))}
        </Card>
      </div>
    </div>
  );
}
