import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Header } from '../components/layout';
import { supabase } from '../lib/supabase';
import type { Page, DatabaseColumn, PageWithProperties } from '../types';
import styles from './Page.module.css';

interface DatabasePageProps {
  page: Page;
  onUpdate: (page: Page) => void;
}

export function DatabasePage({ page, onUpdate }: DatabasePageProps) {
  const { id: sectionId } = useParams<{ id: string }>();
  const [columns, setColumns] = useState<DatabaseColumn[]>([]);
  const [rows, setRows] = useState<PageWithProperties[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(page.name);
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
      const { error } = await supabase
        .from('pages')
        .update({ name: editRowTitleValue.trim() })
        .eq('id', rowId);

      if (!error) {
        setRows(rows.map(row =>
          row.id === rowId ? { ...row, name: editRowTitleValue.trim() } : row
        ));
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

  return (
    <div>
      <Header title={headerContent} />
      <div className={styles.content}>
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
    </div>
  );
}
