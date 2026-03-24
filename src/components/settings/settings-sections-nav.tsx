import { SETTINGS_SECTIONS } from "@/shared/types/settings";

export function SettingsSectionsNav() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {SETTINGS_SECTIONS.map((section) => (
        <button
          key={section.code}
          className="rounded-2xl border border-border bg-white/80 px-4 py-3 text-left transition hover:bg-white"
        >
          <p className="text-sm font-semibold">{section.title}</p>
          <p className="mt-1 text-xs text-neutral-500">{section.description}</p>
        </button>
      ))}
    </div>
  );
}
