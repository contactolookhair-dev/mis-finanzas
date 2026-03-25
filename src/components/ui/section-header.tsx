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
        "flex flex-col gap-4",
        align === "center"
          ? "items-center text-center"
          : "sm:flex-row sm:items-end sm:justify-between"
      ].join(" ")}
    >
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">
            {eyebrow}
          </p>
        ) : null}
        <div className={compact ? "space-y-0.5" : "space-y-1"}>
          <h1
            className={
              compact
                ? "text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
                : "text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
            }
          >
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-neutral-600 sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}
