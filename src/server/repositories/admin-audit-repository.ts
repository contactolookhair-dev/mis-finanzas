import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { FieldChange } from "@/shared/types/settings-admin";

export async function createAdminAuditLog(input: {
  workspaceId: string;
  userKey: string;
  sessionId?: string;
  section: string;
  action: string;
  changedFields: FieldChange[];
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
}) {
  return prisma.adminAuditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userKey: input.userKey,
      sessionId: input.sessionId,
      section: input.section,
      action: input.action,
      changedFields: input.changedFields as unknown as Prisma.InputJsonValue,
      beforeData: input.beforeData as Prisma.InputJsonValue | undefined,
      afterData: input.afterData as Prisma.InputJsonValue | undefined
    }
  });
}

export async function listRecentAdminAuditLogs(workspaceId: string, take = 20) {
  return prisma.adminAuditLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take
  });
}

export async function listRecentAdminAuditLogsByAction(
  workspaceId: string,
  action: string,
  take = 10
) {
  return prisma.adminAuditLog.findMany({
    where: { workspaceId, action },
    orderBy: { createdAt: "desc" },
    take
  });
}
