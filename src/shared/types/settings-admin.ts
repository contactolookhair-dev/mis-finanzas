import type { SettingsSectionCode } from "@/shared/types/settings";

export type EditableSettingsSection = Extract<
  SettingsSectionCode,
  "ai" | "general" | "dashboard" | "regional_preferences"
>;

export type FieldChange = {
  fieldPath: string;
  previousValue: unknown;
  nextValue: unknown;
};

export type SectionChangeSummary = {
  section: EditableSettingsSection;
  changed: boolean;
  changes: FieldChange[];
};

export type SettingsAuditLogItem = {
  id: string;
  section: EditableSettingsSection;
  action: string;
  userKey: string;
  sessionId?: string | null;
  createdAt: string;
  changedFields: FieldChange[];
};

