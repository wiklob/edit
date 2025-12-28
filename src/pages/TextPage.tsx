import { useState, useEffect, useRef } from 'react';
import { IconPicker } from '../components/common';
import type { IconPickerHandle } from '../components/common';
import { supabase, useBreadcrumbs, useSidebar } from '../lib';
import type { Page, PagePropertyWithColumn } from '../types';
import styles from './Page.module.css';

interface TextPageProps {
  page: Page;
}

const DEFAULT_ICON = 'lucide:file-text:default';

export function TextPage({ page }: TextPageProps) {
  const { breadcrumbs, setBreadcrumbs } = useBreadcrumbs();
  const { updatePageIcon } = useSidebar();
  const iconPickerRef = useRef<IconPickerHandle>(null);
  const [pageIcon, setPageIcon] = useState(page.icon);
  const [pageName, setPageName] = useState(page.name);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(page.name);
  const [properties, setProperties] = useState<PagePropertyWithColumn[]>([]);
  const [content, setContent] = useState(page.content || '');
  const [loading, setLoading] = useState(true);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editPropertyValue, setEditPropertyValue] = useState('');

  useEffect(() => {
    const fetchProperties = async () => {
      // Only fetch properties if this is a row in a database (has parent_id)
      if (page.parent_id) {
        const { data } = await supabase
          .from('page_properties')
          .select('*, column:database_columns(*)')
          .eq('page_id', page.id)
          .order('column(display_order)');

        if (data) {
          // Filter out Title column - we handle it separately using pages.name
          const filtered = (data as unknown as PagePropertyWithColumn[])
            .filter(p => p.column.name !== 'Title');
          setProperties(filtered);
        }
      }
      setLoading(false);
    };

    fetchProperties();
  }, [page.id, page.parent_id]);

  const handleStartEditTitle = () => {
    setIsEditingTitle(true);
    setEditTitleValue(pageName);
  };

  const handleSaveTitle = async () => {
    const newName = editTitleValue.trim();
    if (newName && newName !== pageName) {
      const { error } = await supabase
        .from('pages')
        .update({ name: newName })
        .eq('id', page.id);

      if (!error) {
        setPageName(newName);
        // Update breadcrumbs
        const updated = [...breadcrumbs];
        if (updated.length > 0) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], label: newName };
        }
        setBreadcrumbs(updated);
      }
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const handleIconChange = async (newIcon: string) => {
    const { error } = await supabase
      .from('pages')
      .update({ icon: newIcon })
      .eq('id', page.id);

    if (!error) {
      setPageIcon(newIcon);
      updatePageIcon(page.id, newIcon);
      // Update breadcrumbs
      const updated = [...breadcrumbs];
      if (updated.length > 0) {
        updated[updated.length - 1] = { ...updated[updated.length - 1], icon: newIcon };
      }
      setBreadcrumbs(updated);
    }
  };

  const handleAddIcon = async () => {
    const { error } = await supabase
      .from('pages')
      .update({ icon: DEFAULT_ICON })
      .eq('id', page.id);

    if (!error) {
      setPageIcon(DEFAULT_ICON);
      updatePageIcon(page.id, DEFAULT_ICON);
      // Update breadcrumbs
      const updated = [...breadcrumbs];
      if (updated.length > 0) {
        updated[updated.length - 1] = { ...updated[updated.length - 1], icon: DEFAULT_ICON };
      }
      setBreadcrumbs(updated);
      setTimeout(() => iconPickerRef.current?.open(), 0);
    }
  };

  const handleRemoveIcon = async () => {
    const { error } = await supabase
      .from('pages')
      .update({ icon: null })
      .eq('id', page.id);

    if (!error) {
      setPageIcon(null);
      updatePageIcon(page.id, null);
      // Update breadcrumbs
      const updated = [...breadcrumbs];
      if (updated.length > 0) {
        updated[updated.length - 1] = { ...updated[updated.length - 1], icon: null };
      }
      setBreadcrumbs(updated);
    }
  };

  const handleContentChange = async (newContent: string) => {
    setContent(newContent);
  };

  const handleContentBlur = async () => {
    if (content !== page.content) {
      await supabase
        .from('pages')
        .update({ content })
        .eq('id', page.id);
    }
  };

  const handleStartEditProperty = (prop: PagePropertyWithColumn) => {
    setEditingPropertyId(prop.id);
    setEditPropertyValue(prop.value || '');
  };

  const handleSaveProperty = async () => {
    if (!editingPropertyId) return;

    const { error } = await supabase
      .from('page_properties')
      .update({ value: editPropertyValue })
      .eq('id', editingPropertyId);

    if (!error) {
      setProperties(properties.map(p =>
        p.id === editingPropertyId ? { ...p, value: editPropertyValue } : p
      ));
    }
    setEditingPropertyId(null);
  };

  const handlePropertyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveProperty();
    } else if (e.key === 'Escape') {
      setEditingPropertyId(null);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className={styles.content}>
      {pageIcon && (
        <IconPicker ref={iconPickerRef} icon={pageIcon} onSelect={handleIconChange} onRemove={handleRemoveIcon} size="large" />
      )}
      <div className={styles.titleSection}>
        <div className={styles.actionRow}>
          {!pageIcon && (
            <button className={styles.actionBtn} onClick={handleAddIcon} type="button">
              Add icon
            </button>
          )}
        </div>
        {isEditingTitle ? (
          <input
            type="text"
            value={editTitleValue}
            onChange={(e) => setEditTitleValue(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleTitleKeyDown}
            className={styles.pageTitleInput}
            autoFocus
          />
        ) : (
          <h1 className={styles.pageTitle} onClick={handleStartEditTitle}>
            {pageName}
          </h1>
        )}
      </div>
      {page.parent_id && (
        <div className={styles.propertiesSection}>
          {/* Properties from database columns */}
          {properties.map((prop) => (
            <div key={prop.id} className={styles.propertyRow}>
              <label className={styles.propertyLabel}>{prop.column.name}</label>
              {editingPropertyId === prop.id ? (
                <input
                  type="text"
                  value={editPropertyValue}
                  onChange={(e) => setEditPropertyValue(e.target.value)}
                  onBlur={handleSaveProperty}
                  onKeyDown={handlePropertyKeyDown}
                  className={styles.propertyInput}
                  autoFocus
                />
              ) : (
                <span
                  className={styles.propertyValue}
                  onClick={() => handleStartEditProperty(prop)}
                >
                  {prop.value || 'Empty'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <textarea
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        onBlur={handleContentBlur}
        className={styles.contentEditor}
        placeholder="Start writing..."
      />
    </div>
  );
}
