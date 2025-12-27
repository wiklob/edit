import { Navigate } from 'react-router-dom';
import { useWorkspace } from '../../lib';

interface RequireWorkspaceProps {
  children: React.ReactNode;
}

export function RequireWorkspace({ children }: RequireWorkspaceProps) {
  const { currentWorkspace, loading } = useWorkspace();

  if (loading) {
    return null;
  }

  if (!currentWorkspace) {
    return <Navigate to="/workspaces" replace />;
  }

  return <>{children}</>;
}
