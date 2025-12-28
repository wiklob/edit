import { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { supabase } from '../lib/supabase';
import type { Page, PagePropertyWithColumn } from '../types';
import styles from './Page.module.css';

interface TextPageProps {
  page: Page;
  onUpdate: (page: Page) => void;
}

export function TextPage({ page, onUpdate }: TextPageProps) {
  const [properties, setProperties] = useState<PagePropertyWithColumn[]>([]);
  const [content, setContent] = useState(page.content || '');
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(page.name);
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
          setProperties(data as unknown as PagePropertyWithColumn[]);
        }
      }
      setLoading(false);
    };

    fetchProperties();
  }, [page.id, page.parent_id]);

  const handleNameSave = async () => {
    if (editName.trim() && editName !== page.name) {
      const { error } = await supabase
        .from('pages')
        .update({ name: editName.trim() })
        .eq('id', page.id);

      if (!error) {
        onUpdate({ ...page, name: editName.trim() });
      }
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setEditName(page.name);
      setIsEditingName(false);
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
      setProperties(properties.map(prop =>
        prop.id === editingPropertyId ? { ...prop, value: editPropertyValue } : prop
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

  const headerContent = isEditingName ? (
    <input
      type="text"
      value={editName}
      onChange={(e) => setEditName(e.target.value)}
      onBlur={handleNameSave}
      onKeyDown={handleNameKeyDown}
      className={styles.nameInput}
      autoFocus
    />
  ) : (
    <span onClick={() => setIsEditingName(true)} className={styles.editableName}>
      {page.name}
    </span>
  );

  if (loading) {
    return (
      <div>
        <Header title="Loading..." />
      </div>
    );
  }

  return (
    <div>
      <Header title={headerContent} />
      <div className={styles.content}>
        {properties.length > 0 && (
          <div className={styles.propertiesSection}>
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
    </div>
  );
}
