import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Header } from '../components/layout';
import { Placeholder } from '../components/common';
import { supabase } from '../lib/supabase';
import { DatabasePage } from './DatabasePage';
import { TextPage } from './TextPage';
import type { Page as PageType } from '../types';

export function Page() {
  const { pageId } = useParams<{ pageId: string }>();
  const [page, setPage] = useState<PageType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pageId) return;

    const fetchPage = async () => {
      const { data } = await supabase
        .from('pages')
        .select('*')
        .eq('id', pageId)
        .single();

      if (data) {
        setPage(data);
      }
      setLoading(false);
    };

    fetchPage();
  }, [pageId]);

  if (loading) {
    return (
      <div>
        <Header title="Loading..." />
      </div>
    );
  }

  if (!page) {
    return (
      <div>
        <Header title="Page not found" />
        <Placeholder message="This page doesn't exist or you don't have access" />
      </div>
    );
  }

  if (page.type === 'database') {
    return <DatabasePage page={page} onUpdate={setPage} />;
  }

  return <TextPage page={page} onUpdate={setPage} />;
}
