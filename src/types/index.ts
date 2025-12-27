export interface NavItem {
  id: string;
  label: string;
  path: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface Section {
  id: string;
  workspace_id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SectionAccess {
  id: string;
  section_id: string;
  member_id: string;
  workspace_id: string;
  created_at: string;
}

// Combined types for convenience
export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole;
}
