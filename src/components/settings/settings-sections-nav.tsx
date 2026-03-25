import { StatPill } from "@/components/ui/stat-pill";
import { SETTINGS_SECTIONS } from "@/shared/types/settings";

export function SettingsSectionsNav() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {SETTINGS_SECTIONS.map((section) => (
        <button
          key={section.code}
          className="group rounded-[24px] border border-border/70 bg-white/82 px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/18 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{section.title}</p>
            <StatPill tone="brand" className="px-2.5 py-1 text-[10px]">
              {section.code}
            </StatPill>
          </div>
          <p className="mt-1 text-xs leading-5 text-neutral-500">{section.description}</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
            <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-primary via-secondary to-accent transition-all duration-300 group-hover:w-[58%]" />
          </div>
        </button>
      ))}
    </div>
  );
}
