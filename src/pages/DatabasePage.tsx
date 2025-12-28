import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconPicker, PageIcon } from '../components/common';
import { supabase, useBreadcrumbs, useSidebar } from '../lib';
import type { Page, DatabaseColumn, PageWithProperties } from '../types';
import styles from './Page.module.css';

interface DatabasePageProps {
  page: Page;
}

export function DatabasePage({ page }: DatabasePageProps) {
  const { id: sectionId } = useParams<{ id: string }>();
  const { breadcrumbs, setBreadcrumbs } = useBreadcrumbs();
  const { updatePageIcon } = useSidebar();
  const [pageIcon, setPageIcon] = useState(page.icon);
  const [pageName, setPageName] = useState(page.name);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(page.name);
  const [columns, setColumns] = useState<DatabaseColumn[]>([]);
  const [rows, setRows] = useState<PageWithProperties[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRowTitle, setEditingRowTitle] = useState<string | null>(null);
  const [editRowTitleValue, setEditRowTitleValue] = useState('');
  const [editingProperty, setEditingProperty] = useState<{ rowId: string; columnId: string } | null>(null);
  const [editPropertyValue, setEditPropertyValue] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      // Fetch columns
      const { data: columnsData } = await supabase
        .from('database_columns')
        .select('*')
        .eq('page_id', page.id)
        .order('display_order');

      if (columnsData) {
        setColumns(columnsData);
      }

      // Fetch rows (text pages with this database as parent)
      const { data: rowsData } = await supabase
        .from('pages')
        .select('*, properties:page_properties(*, column:database_columns(*))')
        .eq('parent_id', page.id)
        .order('display_order');

      if (rowsData) {
        setRows(rowsData as unknown as PageWithProperties[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [page.id]);

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

  const handleAddRow = async () => {
    const { data, error } = await supabase
      .from('pages')
      .insert({
        section_id: page.section_id,
        parent_id: page.id,
        type: 'text',
        name: 'Untitled',
      })
      .select('*, properties:page_properties(*, column:database_columns(*))')
      .single();

    if (data && !error) {
      setRows([...rows, data as unknown as PageWithProperties]);
    }
  };

  const getPropertyValue = (row: PageWithProperties, columnId: string): string => {
    const prop = row.properties.find(p => p.column_id === columnId);
    return prop?.value || '';
  };

  const handleStartEditProperty = (rowId: string, columnId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (row) {
      setEditingProperty({ rowId, columnId });
      setEditPropertyValue(getPropertyValue(row, columnId));
    }
  };

  const handleSaveProperty = async () => {
    if (!editingProperty) return;
    const { rowId, columnId } = editingProperty;

    const { error } = await supabase
      .from('page_properties')
      .update({ value: editPropertyValue })
      .eq('page_id', rowId)
      .eq('column_id', columnId);

    if (!error) {
      setRows(rows.map(row => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          properties: row.properties.map(prop =>
            prop.column_id === columnId ? { ...prop, value: editPropertyValue } : prop
          ),
        };
      }));
    }
    setEditingProperty(null);
  };

  const handlePropertyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveProperty();
    } else if (e.key === 'Escape') {
      setEditingProperty(null);
    }
  };

  const handleStartEditRowTitle = (row: PageWithProperties) => {
    setEditingRowTitle(row.id);
    setEditRowTitleValue(row.name);
  };

  const handleSaveRowTitle = async (rowId: string) => {
    if (editRowTitleValue.trim()) {
      const newName = editRowTitleValue.trim();

      // Update page name
      const { error } = await supabase
        .from('pages')
        .update({ name: newName })
        .eq('id', rowId);

      if (!error) {
        // Also update the Title property to keep them in sync
        const titleColumn = columns.find(c => c.name === 'Title');
        if (titleColumn) {
          await supabase
            .from('page_properties')
            .update({ value: newName })
            .eq('page_id', rowId)
            .eq('column_id', titleColumn.id);
        }

        setRows(rows.map(row => {
          if (row.id !== rowId) return row;
          return {
            ...row,
            name: newName,
            properties: row.properties.map(prop =>
              prop.column?.name === 'Title' ? { ...prop, value: newName } : prop
            ),
          };
        }));
      }
    }
    setEditingRowTitle(null);
  };

  const handleRowTitleKeyDown = (e: React.KeyboardEvent, rowId: string) => {
    if (e.key === 'Enter') {
      handleSaveRowTitle(rowId);
    } else if (e.key === 'Escape') {
      setEditingRowTitle(null);
    }
  };

  return (
    <div className={styles.content}>
      <div className={styles.titleRow}>
        <IconPicker icon={pageIcon} onSelect={handleIconChange} onRemove={pageIcon ? handleRemoveIcon : undefined} size="small" />
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
      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.titleColumn}>Title</th>
                  {columns.filter(c => c.name !== 'Title').map((column) => (
                    <th key={column.id}>{column.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.titleCell}>
                      <div className={styles.titleWrapper}>
                        <span className={styles.rowIcon}>
                          <PageIcon icon={row.icon || 'lucide:file-text:default'} size={14} />
                        </span>
                        {editingRowTitle === row.id ? (
                          <input
                            type="text"
                            value={editRowTitleValue}
                            onChange={(e) => setEditRowTitleValue(e.target.value)}
                            onBlur={() => handleSaveRowTitle(row.id)}
                            onKeyDown={(e) => handleRowTitleKeyDown(e, row.id)}
                            className={styles.titleInput}
                            autoFocus
                          />
                        ) : (
                          <span
                            className={styles.titleText}
                            onClick={() => handleStartEditRowTitle(row)}
                          >
                            {row.name}
                          </span>
                        )}
                        <Link
                          to={`/section/${sectionId}/page/${row.id}`}
                          className={styles.openBtn}
                        >
                          Open
                        </Link>
                      </div>
                    </td>
                    {columns.filter(c => c.name !== 'Title').map((column) => {
                      const isEditing = editingProperty?.rowId === row.id && editingProperty?.columnId === column.id;
                      return (
                        <td key={column.id}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editPropertyValue}
                              onChange={(e) => setEditPropertyValue(e.target.value)}
                              onBlur={handleSaveProperty}
                              onKeyDown={handlePropertyKeyDown}
                              className={styles.cellInput}
                              autoFocus
                            />
                          ) : (
                            <span
                              className={styles.cellText}
                              onClick={() => handleStartEditProperty(row.id, column.id)}
                            >
                              {getPropertyValue(row, column.id) || '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={handleAddRow} className={styles.addRowBtn}>
            + New row
          </button>
        </>
      )}
    </div>
  );
}
