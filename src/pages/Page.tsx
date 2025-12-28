import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Placeholder } from '../components/common';
import { supabase, useBreadcrumbs } from '../lib';
import { DatabasePage } from './DatabasePage';
import { TextPage } from './TextPage';
import type { Page as PageType } from '../types';

export function Page() {
  const { id: sectionId, pageId } = useParams<{ id: string; pageId: string }>();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [page, setPage] = useState<PageType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pageId || !sectionId) return;

    const fetchData = async () => {
      let fetchedPage: PageType | null = null;
      let fetchedParent: PageType | null = null;
      let fetchedSection: { id: string; name: string; icon: string | null } | null = null;

      // Fetch page
      const { data: pageData } = await supabase
        .from('pages')
        .select('*')
        .eq('id', pageId)
        .single();

      if (pageData) {
        fetchedPage = pageData;
        setPage(pageData);

        // Fetch parent page if exists
        if (pageData.parent_id) {
          const { data: parentData } = await supabase
            .from('pages')
            .select('*')
            .eq('id', pageData.parent_id)
            .single();

          if (parentData) {
            fetchedParent = parentData;
          }
        }
      }

      // Fetch section
      const { data: sectionData } = await supabase
        .from('sections')
        .select('*')
        .eq('id', sectionId)
        .single();

      if (sectionData) {
        fetchedSection = sectionData;
      }

      // Build and set breadcrumbs
      const items = [];
      if (fetchedSection) {
        items.push({ label: fetchedSection.name, icon: fetchedSection.icon, to: `/section/${fetchedSection.id}` });
      }
      if (fetchedParent) {
        items.push({ label: fetchedParent.name, icon: fetchedParent.icon, to: `/section/${sectionId}/page/${fetchedParent.id}` });
      }
      if (fetchedPage) {
        items.push({ label: fetchedPage.name, icon: fetchedPage.icon });
      }
      setBreadcrumbs(items);

      setLoading(false);
    };

    fetchData();
  }, [pageId, sectionId, setBreadcrumbs]);

  if (loading) {
    return null;
  }

  if (!page) {
    return <Placeholder message="This page doesn't exist or you don't have access" />;
  }

  if (page.type === 'database') {
    return <DatabasePage page={page} />;
  }

  return <TextPage page={page} />;
}
