export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export type SessionPermissions = {
  canViewSettings: boolean;
  canViewAuditLog: boolean;
  canEditSettings: boolean;
  canEditAI: boolean;
  canEditDashboard: boolean;
  canEditModules: boolean;
  canImportTransactions: boolean;
  canExportReports: boolean;
  canQueryAI: boolean;
};

export type SessionMembership = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: WorkspaceRole;
};

export type AuthSessionResponse =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      user: {
        userKey: string;
        displayName: string | null;
      };
      activeWorkspace: {
        workspaceId: string;
        workspaceName: string;
        workspaceSlug: string;
        role: WorkspaceRole;
      } | null;
      permissions: SessionPermissions | null;
      memberships: SessionMembership[];
    };
