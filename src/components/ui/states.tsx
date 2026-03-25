"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function Skeleton({
  className = ""
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

export function SkeletonCard({
  lines = 3,
  className = ""
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <Card className={`rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ${className}`}>
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-44" />
        {Array.from({ length: Math.max(1, lines) }).map((_, index) => (
          <Skeleton key={`line-${index}`} className={`h-3 ${index % 2 === 0 ? "w-72" : "w-56"}`} />
        ))}
      </div>
    </Card>
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
  const Icon = icon ?? Inbox;

  return (
    <Card className={`rounded-[28px] border border-dashed border-slate-200 bg-gradient-to-br from-white/80 via-slate-50/70 to-white/80 p-5 shadow-[0_14px_38px_rgba(15,23,42,0.06)] ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          {actionLabel && onAction ? (
            <div className="mt-3">
              <Button variant="secondary" className="h-9 rounded-full px-4 text-xs font-semibold" onClick={onAction}>
                {actionLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
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
    <Card className={`rounded-[28px] border border-rose-100 bg-gradient-to-br from-rose-50/70 via-white/70 to-amber-50/40 p-5 shadow-[0_14px_38px_rgba(15,23,42,0.06)] ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-rose-600 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
          {details ? <p className="mt-2 text-xs text-rose-700">{details}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onRetry ? (
              <Button
                variant="secondary"
                className="h-9 rounded-full px-4 text-xs font-semibold"
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
    </Card>
  );
}
