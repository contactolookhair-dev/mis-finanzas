import type {
  AISettingsPayload,
  AppSettingsPayload,
  DashboardSettingsPayload,
  UserRegionalPreferences
} from "@/shared/types/settings";
import type {
  EditableSettingsSection,
  FieldChange,
  SectionChangeSummary
} from "@/shared/types/settings-admin";

export type SettingsSnapshotLike = {
  appSettings: AppSettingsPayload;
  aiSettings: AISettingsPayload;
  dashboardSettings: DashboardSettingsPayload;
  userSettings: UserRegionalPreferences;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nestedValue]) => [key, stableValue(nestedValue)])
    );
  }
  return value;
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function collectChanges(
  previousValue: unknown,
  nextValue: unknown,
  path: string,
  out: FieldChange[]
) {
  if (valuesEqual(previousValue, nextValue)) {
    return;
  }

  const previousIsObject =
    previousValue !== null && typeof previousValue === "object" && !Array.isArray(previousValue);
  const nextIsObject =
    nextValue !== null && typeof nextValue === "object" && !Array.isArray(nextValue);

  if (previousIsObject && nextIsObject) {
    const previousObject = previousValue as Record<string, unknown>;
    const nextObject = nextValue as Record<string, unknown>;
    const keys = new Set([...Object.keys(previousObject), ...Object.keys(nextObject)]);
    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key;
      collectChanges(previousObject[key], nextObject[key], nextPath, out);
    }
    return;
  }

  out.push({
    fieldPath: path || "root",
    previousValue,
    nextValue
  });
}

function getSectionData(snapshot: SettingsSnapshotLike, section: EditableSettingsSection) {
  switch (section) {
    case "ai":
      return snapshot.aiSettings;
    case "general":
      return snapshot.appSettings;
    case "dashboard":
      return snapshot.dashboardSettings;
    case "regional_preferences":
      return snapshot.userSettings;
  }
}

export function computeSectionChanges(
  section: EditableSettingsSection,
  previousSnapshot: SettingsSnapshotLike,
  nextSnapshot: SettingsSnapshotLike
): SectionChangeSummary {
  const previousSection = getSectionData(previousSnapshot, section);
  const nextSection = getSectionData(nextSnapshot, section);
  const changes: FieldChange[] = [];
  collectChanges(previousSection, nextSection, "", changes);

  return {
    section,
    changed: changes.length > 0,
    changes
  };
}

export function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

