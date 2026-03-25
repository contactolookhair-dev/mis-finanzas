"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, CreditCard, FileText, Receipt, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";

type Action = {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: string;
  onClick: () => void;
};

export function DashboardQuickActions({
  onExpense,
  onIncome,
  onDebt,
  onReports
}: {
  onExpense: () => void;
  onIncome: () => void;
  onDebt: () => void;
  onReports: () => void;
}) {
  const actions: Action[] = [
    {
      key: "expense",
      title: "Gasto",
      subtitle: "Registrar egreso",
      icon: Receipt,
      tone: "from-rose-500/10 via-white/80 to-rose-400/10",
      onClick: onExpense
    },
    {
      key: "income",
      title: "Ingreso",
      subtitle: "Registrar entrada",
      icon: Wallet,
      tone: "from-emerald-500/10 via-white/80 to-emerald-400/10",
      onClick: onIncome
    },
    {
      key: "debt",
      title: "Deuda",
      subtitle: "Pendientes",
      icon: CreditCard,
      tone: "from-amber-500/10 via-white/80 to-amber-400/10",
      onClick: onDebt
    },
    {
      key: "reports",
      title: "Reportes",
      subtitle: "PDF/Excel",
      icon: FileText,
      tone: "from-cyan-500/10 via-white/80 to-cyan-400/10",
      onClick: onReports
    }
  ];

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Acciones rapidas</p>
        <h2 className="text-lg font-semibold text-slate-900">Un toque y listo</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            className="group tap-feedback text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Card className="relative overflow-hidden rounded-[26px] border border-border/70 bg-gradient-to-br p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(15,23,42,0.1)] active:translate-y-0">
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${action.tone}`} />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.72),transparent_38%)]" />
              <div className="relative flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-white/82 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.1)]">
                  <action.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-slate-500 group-active:translate-x-0.5 group-active:-translate-y-0.5" />
              </div>
              <p className="relative mt-3 text-sm font-semibold text-slate-900">{action.title}</p>
              <p className="relative text-xs text-slate-500">{action.subtitle}</p>
            </Card>
          </button>
        ))}
      </div>
    </section>
  );
}
