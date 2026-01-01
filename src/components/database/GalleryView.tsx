import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageIcon } from '../common';
import type { DatabaseColumn, PageWithProperties } from '../../types';
import styles from './Database.module.css';

interface GalleryViewProps {
  rows: PageWithProperties[];
  columns: DatabaseColumn[];
  sectionId: string;
  onAddRow: () => void;
  onUpdateRowName: (rowId: string, newName: string) => void;
}

export function GalleryView({
  rows,
  columns,
  sectionId,
  onAddRow,
  onUpdateRowName,
}: GalleryViewProps) {
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Get columns to show on cards (first 2-3, excluding Title)
  const cardColumns = columns.filter(c => c.name !== 'Title').slice(0, 3);

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
      return value === 'true' ? '✓' : '✗';
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

  // Generate a color based on the row id for the cover
  const getCoverColor = (id: string): string => {
    const colors = [
      'rgba(59, 130, 246, 0.15)',  // blue
      'rgba(16, 185, 129, 0.15)',  // green
      'rgba(245, 158, 11, 0.15)',  // amber
      'rgba(239, 68, 68, 0.15)',   // red
      'rgba(139, 92, 246, 0.15)',  // purple
      'rgba(236, 72, 153, 0.15)',  // pink
      'rgba(20, 184, 166, 0.15)',  // teal
    ];
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className={styles.galleryView}>
      {rows.map(row => (
        <div key={row.id} className={styles.galleryCard}>
          <Link
            to={`/section/${sectionId}/page/${row.id}`}
            className={styles.galleryCardCover}
            style={{ backgroundColor: getCoverColor(row.id) }}
          >
            <PageIcon icon={row.icon || 'lucide:file-text:default'} size={32} />
          </Link>
          <div className={styles.galleryCardContent}>
            {editingRowId === row.id ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleSaveEdit(row.id)}
                onKeyDown={(e) => handleKeyDown(e, row.id)}
                className={styles.galleryCardInput}
                autoFocus
              />
            ) : (
              <div
                className={styles.galleryCardTitle}
                onClick={() => handleStartEdit(row)}
              >
                {row.name}
              </div>
            )}
            <div className={styles.galleryCardProperties}>
              {cardColumns.map(column => {
                const value = getPropertyValue(row, column.id);
                const formatted = formatValue(value, column);
                return (
                  <div key={column.id} className={styles.galleryCardProperty}>
                    <span className={styles.galleryCardPropertyName}>{column.name}</span>
                    <span className={styles.galleryCardPropertyValue}>
                      {formatted || '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
      <button className={styles.galleryAddCard} onClick={onAddRow}>
        <span className={styles.galleryAddIcon}>+</span>
        <span>New page</span>
      </button>
    </div>
  );
}
