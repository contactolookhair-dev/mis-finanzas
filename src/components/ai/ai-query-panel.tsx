"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BrainCircuit, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import type { AuthSessionResponse } from "@/shared/types/auth";
import type { FinancialAIResponse } from "@/shared/types/ai";

function ResponseBlock({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-white/80 bg-white/75 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">{title}</p>
      <div className="mt-2 text-sm text-neutral-700">{children}</div>
    </div>
  );
}

export function AIQueryPanel() {
  const [question, setQuestion] = useState("¿Por qué subieron mis gastos este mes?");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);
  const [response, setResponse] = useState<FinancialAIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        setAuthLoading(true);
        const session = await fetchAuthSession();
        setAuthSession(session);
      } catch {
        setAuthSession({ authenticated: false });
      } finally {
        setAuthLoading(false);
      }
    }

    void loadSession();
  }, []);

  const canQueryAI =
    authSession?.authenticated === true && authSession.permissions ? authSession.permissions.canQueryAI : false;
  const activeWorkspaceName =
    authSession?.authenticated === true ? authSession.activeWorkspace?.workspaceName : null;

  async function handleSubmit() {
    if (!canQueryAI) {
      setError("No tienes permisos para consultar la IA financiera.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/ai/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question
        })
      });

      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "Error al consultar IA");
      }

      const payload = (await res.json()) as FinancialAIResponse;
      setResponse(payload);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Asistente financiero IA</h3>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Usa histórico real del workspace, comparativas y patrones internos para explicar, alertar y recomendar.
          </p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm text-neutral-700">
          {authLoading
            ? "Validando sesión..."
            : activeWorkspaceName
              ? `Workspace activo: ${activeWorkspaceName}`
              : "Sin workspace activo. Inicia sesión para usar la IA."}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/80 bg-gradient-to-br from-white to-[#f4efe8] p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
          <Sparkles className="h-4 w-4" />
          Consulta contextual
        </div>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ej: ¿Qué patrones negativos estás viendo en mis gastos?"
          />
          <Button onClick={handleSubmit} disabled={loading || authLoading || !canQueryAI}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analizando
              </>
            ) : (
              "Consultar IA"
            )}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {response ? (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/80 bg-[#0f3d3e] p-5 text-white shadow-card">
            <p className="text-xs uppercase tracking-[0.22em] text-white/65">Respuesta principal</p>
            <p className="mt-3 text-base leading-7 text-white/92">{response.answer}</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <ResponseBlock title="Resumen">
                <p>{response.sections.summary}</p>
              </ResponseBlock>
              <ResponseBlock title="Explicación">
                <p>{response.sections.explanation}</p>
              </ResponseBlock>
              <ResponseBlock title="Recomendaciones">
                <div className="space-y-2">
                  {response.sections.recommendations.length === 0 ? (
                    <p>No hay recomendaciones adicionales para esta consulta.</p>
                  ) : (
                    response.sections.recommendations.map((item) => (
                      <div key={item} className="rounded-2xl bg-[#f8f4ed] px-3 py-3">
                        {item}
                      </div>
                    ))
                  )}
                </div>
              </ResponseBlock>
            </div>

            <div className="space-y-4">
              <ResponseBlock title="Hallazgos">
                <div className="space-y-2">
                  {response.sections.keyFindings.length === 0 ? (
                    <p>No hay hallazgos destacados adicionales.</p>
                  ) : (
                    response.sections.keyFindings.map((item) => (
                      <div key={item} className="rounded-2xl bg-[#f8f4ed] px-3 py-3">
                        {item}
                      </div>
                    ))
                  )}
                </div>
              </ResponseBlock>
              <ResponseBlock title="Datos usados">
                <div className="space-y-2">
                  {response.sections.dataUsed.map((item) => (
                    <div key={item} className="rounded-2xl bg-[#f8f4ed] px-3 py-3">
                      {item}
                    </div>
                  ))}
                </div>
              </ResponseBlock>
              <ResponseBlock title="Próximas preguntas">
                <div className="space-y-2">
                  {response.nextSuggestedQuestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setQuestion(item)}
                      className="w-full rounded-2xl bg-[#f8f4ed] px-3 py-3 text-left transition hover:bg-[#efe7da]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </ResponseBlock>
            </div>
          </div>

          <details className="rounded-[24px] border border-white/80 bg-white/75 p-4">
            <summary className="cursor-pointer text-sm font-medium text-neutral-700">
              Ver datos estructurados usados por la IA
            </summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-white/90 p-3 text-xs">
              {JSON.stringify(response.data, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </Card>
  );
}
