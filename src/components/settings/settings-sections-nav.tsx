import { StatPill } from "@/components/ui/stat-pill";
import { SETTINGS_SECTIONS } from "@/shared/types/settings";

export function SettingsSectionsNav() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {SETTINGS_SECTIONS.map((section) => (
        <button
          key={section.code}
          className="rounded-[24px] border border-white/75 bg-white/82 px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{section.title}</p>
            <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
              {section.code}
            </StatPill>
          </div>
          <p className="mt-1 text-xs text-neutral-500">{section.description}</p>
        </button>
      ))}
    </div>
  );
}
