"use client";

import { create } from "zustand";

export type WorkspaceStoreState = {
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceAvatarUrl: string | null;
  // Increments only when the workspace switch is confirmed (cookie/session updated).
  // Used to remount client trees safely after a workspace change.
  workspaceVersion: number;
  setWorkspace: (workspace: { workspaceId: string | null; workspaceName: string | null; workspaceAvatarUrl?: string | null }) => void;
  confirmWorkspace: (workspace: { workspaceId: string | null; workspaceName: string | null; workspaceAvatarUrl?: string | null }) => void;
};

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  workspaceId: null,
  workspaceName: null,
  workspaceAvatarUrl: null,
  workspaceVersion: 0,
  setWorkspace: (workspace) =>
    set({
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
      workspaceAvatarUrl: workspace.workspaceAvatarUrl ?? null
    }),
  confirmWorkspace: (workspace) =>
    set((current) => ({
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
      workspaceAvatarUrl: workspace.workspaceAvatarUrl ?? null,
      workspaceVersion: current.workspaceVersion + 1
    }))
}));
