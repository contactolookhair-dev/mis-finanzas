import type { WorkspaceRole } from "@prisma/client";

export type PermissionAction =
  | "settings:view"
  | "settings:audit:view"
  | "settings:edit"
  | "settings:ai:edit"
  | "settings:dashboard:edit"
  | "settings:modules:edit"
  | "transactions:import"
  | "reports:export"
  | "ai:query";

const permissionsByRole: Record<WorkspaceRole, PermissionAction[]> = {
  OWNER: [
    "settings:view",
    "settings:audit:view",
    "settings:edit",
    "settings:ai:edit",
    "settings:dashboard:edit",
    "settings:modules:edit",
    "transactions:import",
    "reports:export",
    "ai:query"
  ],
  ADMIN: [
    "settings:view",
    "settings:audit:view",
    "settings:edit",
    "settings:ai:edit",
    "settings:dashboard:edit",
    "settings:modules:edit",
    "transactions:import",
    "reports:export",
    "ai:query"
  ],
  EDITOR: ["settings:view", "settings:ai:edit", "transactions:import", "reports:export", "ai:query"],
  VIEWER: ["settings:view", "ai:query"]
};

export function hasPermission(role: WorkspaceRole, action: PermissionAction) {
  return permissionsByRole[role].includes(action);
}
