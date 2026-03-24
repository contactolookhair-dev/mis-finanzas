import {
  createAdminAuditLog,
  listRecentAdminAuditLogs
} from "@/server/repositories/admin-audit-repository";
import type { FieldChange } from "@/shared/types/settings-admin";

export async function registerSettingsAudit(input: {
  workspaceId: string;
  userKey: string;
  sessionId?: string;
  section: string;
  changedFields: FieldChange[];
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
}) {
  if (input.changedFields.length === 0) return null;

  return createAdminAuditLog({
    workspaceId: input.workspaceId,
    userKey: input.userKey,
    sessionId: input.sessionId,
    section: input.section,
    action: "settings.update",
    changedFields: input.changedFields,
    beforeData: input.beforeData,
    afterData: input.afterData
  });
}

export async function getRecentSettingsAudits(workspaceId: string, take?: number) {
  return listRecentAdminAuditLogs(workspaceId, take);
}

