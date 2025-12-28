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
  join_code: string;
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
  display_order: number;
  is_archived: boolean;
  created_at: string;
}

export interface SectionAccess {
  id: string;
  section_id: string;
  member_id: string;
  workspace_id: string;
  created_at: string;
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JoinRequest {
  id: string;
  workspace_id: string;
  user_id: string;
  status: JoinRequestStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface JoinRequestWithUser extends JoinRequest {
  user: User;
}

export interface WorkspaceMemberWithUser extends WorkspaceMember {
  user: User;
}

export interface SectionAccessWithMember extends SectionAccess {
  member: WorkspaceMemberWithUser;
}

// Combined types for convenience
export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole;
}

// Page types
export type PageType = 'database' | 'text';
export type DatabaseType = 'articles';

export interface Page {
  id: string;
  section_id: string;
  parent_id: string | null;
  type: PageType;
  database_type: DatabaseType | null;
  name: string;
  content: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseColumn {
  id: string;
  page_id: string;
  name: string;
  property_type: string;
  display_order: number;
  created_at: string;
}

export interface PageProperty {
  id: string;
  page_id: string;
  column_id: string;
  value: string | null;
  created_at: string;
  updated_at: string;
}

export interface PagePropertyWithColumn extends PageProperty {
  column: DatabaseColumn;
}

export interface PageWithProperties extends Page {
  properties: PagePropertyWithColumn[];
}

export interface DatabasePageWithColumns extends Page {
  columns: DatabaseColumn[];
}

export interface DatabasePageWithRows extends DatabasePageWithColumns {
  rows: PageWithProperties[];
}
