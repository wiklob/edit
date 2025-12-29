import { useState } from 'react';
import type { DatabaseColumn } from '../../types';
import type { Filter, FilterOperator } from './types';
import { FILTER_OPERATORS, operatorNeedsValue } from './types';
import styles from './Database.module.css';

interface FilterPopupProps {
  anchorRect: DOMRect;
  columns: DatabaseColumn[];
  filter?: Filter; // If provided, we're editing; otherwise, adding
  onSave: (filter: Filter) => void;
  onClose: () => void;
}

export function FilterPopup({ anchorRect, columns, filter, onSave, onClose }: FilterPopupProps) {
  const [columnId, setColumnId] = useState(filter?.columnId || columns[0]?.id || '');
  const [operator, setOperator] = useState<FilterOperator>(filter?.operator || 'contains');
  const [value, setValue] = useState(filter?.value || '');

  const needsValue = operatorNeedsValue(operator);
  const canApply = columnId && (!needsValue || value.trim() !== '');

  const handleApply = () => {
    if (!canApply) return;

    onSave({
      id: filter?.id || crypto.randomUUID(),
      columnId,
      operator,
      value: needsValue ? value.trim() : '',
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canApply) {
      handleApply();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <>
      <div className={styles.popupOverlay} onClick={onClose} />
      <div
        className={styles.filterPopup}
        style={{
          top: anchorRect.bottom + 4,
          left: anchorRect.left,
        }}
      >
        <div className={styles.filterPopupContent}>
          <div className={styles.filterSelectRow}>
            <select
              className={styles.filterSelect}
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
            >
              {columns.map(col => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
            <select
              className={styles.filterSelect}
              value={operator}
              onChange={(e) => setOperator(e.target.value as FilterOperator)}
            >
              {FILTER_OPERATORS.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>

          {needsValue && (
            <input
              type="text"
              className={styles.filterInput}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter value..."
              autoFocus
            />
          )}

          <div className={styles.filterActions}>
            <button
              className={styles.filterApplyBtn}
              onClick={handleApply}
              disabled={!canApply}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Keep backward-compatible export
export { FilterPopup as AddFilterPopup };
