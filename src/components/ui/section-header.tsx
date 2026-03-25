import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  compact = false,
  align = "default"
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  compact?: boolean;
  align?: "default" | "center";
}) {
  return (
    <div
      className={[
        "flex flex-col gap-4 sm:gap-5",
        align === "center"
          ? "items-center text-center"
          : "sm:flex-row sm:items-end sm:justify-between"
      ].join(" ")}
    >
      <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
            {eyebrow}
          </p>
        ) : null}
        <div className={compact ? "space-y-1" : "space-y-1.5"}>
          <h1
            className={
              compact
                ? "text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[2rem]"
                : "text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-[2.35rem] lg:text-[2.7rem]"
            }
          >
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-6 text-neutral-600 sm:text-[15px] sm:leading-6">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">{actions}</div>
      ) : null}
    </div>
  );
}
