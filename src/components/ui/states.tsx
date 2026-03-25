"use client";

import type { ReactNode } from "react";
import { AlertTriangle, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

export function Skeleton({
  className = ""
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-xl bg-muted/80 ${className}`} />;
}

export function SkeletonCard({
  lines = 3,
  className = ""
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <SurfaceCard variant="soft" className={`space-y-3 ${className}`}>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-8 w-44" />
      {Array.from({ length: Math.max(1, lines) }).map((_, index) => (
        <Skeleton key={`line-${index}`} className={`h-3 ${index % 2 === 0 ? "w-72" : "w-56"}`} />
      ))}
    </SurfaceCard>
  );
}

export function EmptyStateCard({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className = ""
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  const Icon = icon ?? Sparkles;

  return (
    <SurfaceCard
      variant="brand"
      className={`relative overflow-hidden border-dashed border-primary/15 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(95,99,242,0.08),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(22,181,154,0.06),transparent_30%)]" />
      <div className="pointer-events-none absolute left-5 top-0 h-1 w-20 rounded-full bg-gradient-to-r from-primary via-secondary to-accent opacity-70" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-gradient-to-br from-white via-primary/6 to-accent/10 text-primary shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
          {actionLabel && onAction ? (
            <div className="mt-3">
              <Button
                variant="secondary"
                className="tap-feedback h-9 rounded-full px-4 text-xs font-semibold"
                onClick={onAction}
              >
                {actionLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </SurfaceCard>
  );
}

export function ErrorStateCard({
  title = "No se pudo cargar",
  description,
  details,
  onRetry,
  className = "",
  footer
}: {
  title?: string;
  description?: string;
  details?: string | null;
  onRetry?: () => void;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <SurfaceCard
      variant="soft"
      className={`relative overflow-hidden border-rose-100 bg-gradient-to-br from-rose-50/74 via-white/72 to-amber-50/42 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(221,86,103,0.08),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(194,138,25,0.06),transparent_30%)]" />
      <div className="pointer-events-none absolute left-5 top-0 h-1 w-20 rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-rose-400 opacity-70" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/88 text-rose-600 shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
          {details ? <p className="mt-2 text-xs text-rose-700">{details}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onRetry ? (
              <Button
                variant="secondary"
                className="tap-feedback h-9 rounded-full px-4 text-xs font-semibold"
                onClick={onRetry}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
            ) : null}
            {footer}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
