"use client";

import { create } from "zustand";

export type WorkspaceStoreState = {
  workspaceId: string | null;
  workspaceName: string | null;
  setWorkspace: (workspace: { workspaceId: string | null; workspaceName: string | null }) => void;
};

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  workspaceId: null,
  workspaceName: null,
  setWorkspace: (workspace) => set(workspace)
}));

