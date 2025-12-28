import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../lib';
import { supabase } from '../lib/supabase';

export function Home() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (!currentWorkspace) return;

    const redirectToFirstSection = async () => {
      const { data } = await supabase
        .from('sections')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .order('display_order')
        .limit(1)
        .single();

      if (data) {
        navigate(`/section/${data.id}`, { replace: true });
      } else {
        navigate('/workspace-settings', { replace: true });
      }
    };

    redirectToFirstSection();
  }, [currentWorkspace, navigate]);

  return null;
}
