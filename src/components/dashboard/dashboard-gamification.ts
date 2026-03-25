import type { FinancialHealthResponse } from "@/shared/types/financial-health";

export type FinancialLevel = {
  key: "critico" | "en_progreso" | "organizado" | "pro";
  label: string;
  description: string;
  nextLabel: string | null;
  minScore: number;
  nextScore: number | null;
};

const levels: FinancialLevel[] = [
  {
    key: "critico",
    label: "En alerta",
    description: "Ordenemos lo esencial primero.",
    nextLabel: "En progreso",
    minScore: 0,
    nextScore: 45
  },
  {
    key: "en_progreso",
    label: "En progreso",
    description: "Vas tomando control, sigue asi.",
    nextLabel: "Organizado",
    minScore: 45,
    nextScore: 65
  },
  {
    key: "organizado",
    label: "Organizado",
    description: "Buen ritmo. Mantengamos consistencia.",
    nextLabel: "Pro",
    minScore: 65,
    nextScore: 82
  },
  {
    key: "pro",
    label: "Pro",
    description: "Nivel alto de claridad financiera.",
    nextLabel: null,
    minScore: 82,
    nextScore: null
  }
];

export function getGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Buenos dias";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function getFinancialLevel(health: FinancialHealthResponse | null) {
  const score = Math.max(0, Math.min(100, health?.score ?? 0));
  const current = [...levels].reverse().find((level) => score >= level.minScore) ?? levels[0];

  const from = current.minScore;
  const to = current.nextScore ?? 100;
  const pct = current.nextScore ? Math.max(0, Math.min(1, (score - from) / Math.max(1, to - from))) : 1;

  return {
    score,
    current,
    progressPct: pct
  };
}
