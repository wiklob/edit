import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Workspace, WorkspaceWithRole, WorkspaceRole } from '../types';
import { supabase } from './supabase';
import { useAuth } from './auth';

interface WorkspaceContextType {
  workspaces: WorkspaceWithRole[];
  currentWorkspace: WorkspaceWithRole | null;
  setCurrentWorkspace: (workspace: WorkspaceWithRole | null) => void;
  loading: boolean;
  createWorkspace: (name: string, slug: string) => Promise<Workspace | null>;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const WORKSPACE_STORAGE_KEY = 'edit:current-workspace-id';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<WorkspaceWithRole | null>(null);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);

  // Loading is true until both auth and workspaces are loaded
  const loading = authLoading || workspacesLoading;

  const fetchWorkspaces = useCallback(async () => {
    if (authLoading) return; // Wait for auth to complete

    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
      setWorkspacesLoading(false);
      return;
    }

    // Get all memberships with workspace data
    const { data: memberships, error } = await supabase
      .from('workspace_members')
      .select(`
        role,
        workspace:workspaces(*)
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to fetch workspaces:', error);
      setWorkspacesLoading(false);
      return;
    }

    // Transform to WorkspaceWithRole
    const workspacesWithRole: WorkspaceWithRole[] = (memberships || [])
      .filter((m) => m.workspace)
      .map((m) => ({
        ...(m.workspace as unknown as Workspace),
        role: m.role as WorkspaceRole,
      }));

    setWorkspaces(workspacesWithRole);

    // Restore last selected workspace
    const storedId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    const stored = storedId ? workspacesWithRole.find((w) => w.id === storedId) : null;
    setCurrentWorkspaceState(stored || workspacesWithRole[0] || null);

    setWorkspacesLoading(false);
  }, [user, authLoading]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const setCurrentWorkspace = (workspace: WorkspaceWithRole | null) => {
    setCurrentWorkspaceState(workspace);
    if (workspace) {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.id);
    } else {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    }
  };

  const createWorkspace = async (name: string, slug: string): Promise<Workspace | null> => {
    if (!user) return null;

    // Direct insert - RLS policies now handle the trigger correctly
    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name, slug })
      .select()
      .single();

    if (error) {
      console.error('Failed to create workspace:', error);
      return null;
    }

    // Refetch to get the workspace with role
    await fetchWorkspaces();

    // Set the new workspace as current
    const newWorkspace = workspaces.find((w) => w.id === data.id);
    if (newWorkspace) {
      setCurrentWorkspace(newWorkspace);
    }

    return data;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace,
        loading,
        createWorkspace,
        refetch: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
