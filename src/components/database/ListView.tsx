import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageIcon } from '../common';
import type { DatabaseColumn, PageWithProperties } from '../../types';
import styles from './Database.module.css';

interface ListViewProps {
  rows: PageWithProperties[];
  columns: DatabaseColumn[];
  sectionId: string;
  onAddRow: () => void;
  onUpdateRowName: (rowId: string, newName: string) => void;
}

export function ListView({
  rows,
  columns,
  sectionId,
  onAddRow,
  onUpdateRowName,
}: ListViewProps) {
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Get first 2-3 columns to show inline (excluding Title)
  const inlineColumns = columns.filter(c => c.name !== 'Title').slice(0, 3);

  const getPropertyValue = (row: PageWithProperties, columnId: string): string => {
    const prop = row.properties.find(p => p.column_id === columnId);
    return prop?.value || '';
  };

  const handleStartEdit = (row: PageWithProperties) => {
    setEditingRowId(row.id);
    setEditValue(row.name);
  };

  const handleSaveEdit = (rowId: string) => {
    if (editValue.trim()) {
      onUpdateRowName(rowId, editValue.trim());
    }
    setEditingRowId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(rowId);
    } else if (e.key === 'Escape') {
      setEditingRowId(null);
    }
  };

  const formatValue = (value: string, column: DatabaseColumn): string => {
    if (!value) return '';

    if (column.property_type === 'checkbox') {
      return value === 'true' ? '✓' : '';
    }
    if (column.property_type === 'date') {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    }
    if (column.property_type === 'multi_select') {
      try {
        const arr = JSON.parse(value);
        return Array.isArray(arr) ? arr.join(', ') : value;
      } catch {
        return value;
      }
    }
    return value;
  };

  return (
    <div className={styles.listView}>
      {rows.map(row => (
        <div key={row.id} className={styles.listItem}>
          <div className={styles.listItemMain}>
            <span className={styles.listItemIcon}>
              <PageIcon icon={row.icon || 'lucide:file-text:default'} size={16} />
            </span>
            {editingRowId === row.id ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleSaveEdit(row.id)}
                onKeyDown={(e) => handleKeyDown(e, row.id)}
                className={styles.listItemInput}
                autoFocus
              />
            ) : (
              <span
                className={styles.listItemTitle}
                onClick={() => handleStartEdit(row)}
              >
                {row.name}
              </span>
            )}
          </div>
          <div className={styles.listItemProperties}>
            {inlineColumns.map(column => {
              const value = getPropertyValue(row, column.id);
              const formatted = formatValue(value, column);
              if (!formatted) return null;
              return (
                <span key={column.id} className={styles.listItemProperty}>
                  <span className={styles.listItemPropertyName}>{column.name}:</span>
                  <span className={styles.listItemPropertyValue}>{formatted}</span>
                </span>
              );
            })}
          </div>
          <Link
            to={`/section/${sectionId}/page/${row.id}`}
            className={styles.listItemOpen}
          >
            Open
          </Link>
        </div>
      ))}
      <button className={styles.listAddBtn} onClick={onAddRow}>
        + New page
      </button>
    </div>
  );
}
