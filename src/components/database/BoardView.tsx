import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageIcon } from '../common';
import type { DatabaseColumn, PageWithProperties } from '../../types';
import styles from './Database.module.css';

interface BoardViewProps {
  rows: PageWithProperties[];
  columns: DatabaseColumn[];
  sectionId: string;
  onAddRow: () => void;
  onUpdateRowName: (rowId: string, newName: string) => void;
  onUpdateProperty: (rowId: string, columnId: string, value: string) => void;
}

export function BoardView({
  rows,
  columns,
  sectionId,
  onAddRow,
  onUpdateRowName,
  onUpdateProperty,
}: BoardViewProps) {
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Find the first select column to group by
  const groupByColumn = useMemo(() => {
    return columns.find(c => c.property_type === 'select');
  }, [columns]);

  // Get options for the grouping column
  const groupOptions = useMemo(() => {
    if (!groupByColumn?.options || !Array.isArray(groupByColumn.options)) {
      return ['No Status'];
    }
    const labels = groupByColumn.options.map(opt => opt.label);
    return ['No Status', ...labels];
  }, [groupByColumn]);

  // Group rows by the select column value
  const groupedRows = useMemo(() => {
    const groups: Record<string, PageWithProperties[]> = {};

    // Initialize all groups
    groupOptions.forEach(opt => {
      groups[opt] = [];
    });

    rows.forEach(row => {
      if (!groupByColumn) {
        groups['No Status'].push(row);
        return;
      }

      const prop = row.properties.find(p => p.column_id === groupByColumn.id);
      const value = prop?.value || 'No Status';

      if (!groups[value]) {
        groups[value] = [];
      }
      groups[value].push(row);
    });

    return groups;
  }, [rows, groupByColumn, groupOptions]);

  // Get columns to show on cards (first 2, excluding Title and groupBy column)
  const cardColumns = useMemo(() => {
    return columns
      .filter(c => c.name !== 'Title' && c.id !== groupByColumn?.id)
      .slice(0, 2);
  }, [columns, groupByColumn]);

  const getPropertyValue = (row: PageWithProperties, columnId: string): string => {
    const prop = row.properties.find(p => p.column_id === columnId);
    return prop?.value || '';
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

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, rowId: string) => {
    setDraggedCard(rowId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnName);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, columnName: string) => {
    e.preventDefault();

    if (draggedCard && groupByColumn) {
      const newValue = columnName === 'No Status' ? '' : columnName;
      onUpdateProperty(draggedCard, groupByColumn.id, newValue);
    }

    setDraggedCard(null);
    setDragOverColumn(null);
  };

  if (!groupByColumn) {
    return (
      <div className={styles.boardEmpty}>
        <div className={styles.boardEmptyIcon}>▥</div>
        <div className={styles.boardEmptyTitle}>No Select column found</div>
        <div className={styles.boardEmptyText}>
          Add a Select column to your database to use Board view.
          Cards will be grouped by the select values.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.boardView}>
      {groupOptions.map(columnName => (
        <div
          key={columnName}
          className={`${styles.boardColumn} ${dragOverColumn === columnName ? styles.boardColumnDragOver : ''}`}
          onDragOver={(e) => handleDragOver(e, columnName)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, columnName)}
        >
          <div className={styles.boardColumnHeader}>
            <span className={styles.boardColumnTitle}>{columnName}</span>
            <span className={styles.boardColumnCount}>{groupedRows[columnName]?.length || 0}</span>
          </div>
          <div className={styles.boardColumnCards}>
            {groupedRows[columnName]?.map(row => (
              <div
                key={row.id}
                className={`${styles.boardCard} ${draggedCard === row.id ? styles.boardCardDragging : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, row.id)}
                onDragEnd={handleDragEnd}
              >
                <div className={styles.boardCardHeader}>
                  <span className={styles.boardCardIcon}>
                    <PageIcon icon={row.icon || 'lucide:file-text:default'} size={14} />
                  </span>
                  {editingRowId === row.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleSaveEdit(row.id)}
                      onKeyDown={(e) => handleKeyDown(e, row.id)}
                      className={styles.boardCardInput}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className={styles.boardCardTitle}
                      onClick={() => handleStartEdit(row)}
                    >
                      {row.name}
                    </span>
                  )}
                </div>
                {cardColumns.length > 0 && (
                  <div className={styles.boardCardProperties}>
                    {cardColumns.map(column => {
                      const value = getPropertyValue(row, column.id);
                      const formatted = formatValue(value, column);
                      if (!formatted) return null;
                      return (
                        <div key={column.id} className={styles.boardCardProperty}>
                          <span className={styles.boardCardPropertyName}>{column.name}:</span>
                          <span className={styles.boardCardPropertyValue}>{formatted}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Link
                  to={`/section/${sectionId}/page/${row.id}`}
                  className={styles.boardCardOpen}
                  onClick={(e) => e.stopPropagation()}
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
          <button
            className={styles.boardAddCard}
            onClick={onAddRow}
          >
            + New
          </button>
        </div>
      ))}
    </div>
  );
}
