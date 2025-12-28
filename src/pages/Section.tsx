import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Placeholder, PageIcon } from '../components/common';
import { supabase, useBreadcrumbs } from '../lib';
import type { Section as SectionType, Page } from '../types';
import styles from './Section.module.css';

export function Section() {
  const { id } = useParams<{ id: string }>();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [section, setSection] = useState<SectionType | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      // Fetch section
      const { data: sectionData } = await supabase
        .from('sections')
        .select('*')
        .eq('id', id)
        .single();

      if (sectionData) {
        setSection(sectionData);
        setBreadcrumbs([{ label: sectionData.name, icon: sectionData.icon, to: `/section/${sectionData.id}` }]);
      }

      // Fetch pages in this section (only top-level, not rows)
      const { data: pagesData } = await supabase
        .from('pages')
        .select('*')
        .eq('section_id', id)
        .is('parent_id', null)
        .order('display_order');

      if (pagesData) {
        setPages(pagesData);
      }

      setLoading(false);
    };

    fetchData();
  }, [id, setBreadcrumbs]);

  if (loading) {
    return null;
  }

  if (!section) {
    return <Placeholder message="This section doesn't exist or you don't have access" />;
  }

  return (
    <div className={styles.content}>
      {pages.length === 0 ? (
        <Placeholder message="No pages yet. Use the section menu to create one." />
      ) : (
        <div className={styles.pagesList}>
          {pages.map((page) => (
            <Link
              key={page.id}
              to={`/section/${section.id}/page/${page.id}`}
              className={styles.pageItem}
            >
              <span className={styles.pageIcon}>
                <PageIcon
                  icon={page.icon || (page.type === 'database' ? 'lucide:database:default' : 'lucide:file-text:default')}
                  size={16}
                />
              </span>
              <span className={styles.pageName}>{page.name}</span>
              <span className={styles.pageType}>
                {page.type === 'database' ? page.database_type : 'text'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
