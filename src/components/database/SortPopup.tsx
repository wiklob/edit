import { useState } from 'react';
import type { DatabaseColumn } from '../../types';
import type { SortLevel } from './types';
import styles from './Database.module.css';

interface SortPopupProps {
  anchorRect: DOMRect;
  columns: DatabaseColumn[];
  sorts: SortLevel[];
  onUpdate: (sorts: SortLevel[]) => void;
  onClose: () => void;
  onDeleteAll: () => void;
}

export function SortPopup({ anchorRect, columns, sorts, onUpdate, onClose, onDeleteAll }: SortPopupProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleColumnChange = (sortId: string, columnId: string) => {
    onUpdate(sorts.map(s => s.id === sortId ? { ...s, columnId } : s));
  };

  const handleDirectionChange = (sortId: string, direction: 'asc' | 'desc') => {
    onUpdate(sorts.map(s => s.id === sortId ? { ...s, direction } : s));
  };

  const handleRemove = (sortId: string) => {
    onUpdate(sorts.filter(s => s.id !== sortId));
  };

  const handleAdd = () => {
    // Find first column not already used
    const usedColumnIds = new Set(sorts.map(s => s.columnId));
    const availableColumn = columns.find(c => !usedColumnIds.has(c.id));

    if (availableColumn) {
      onUpdate([...sorts, {
        id: crypto.randomUUID(),
        columnId: availableColumn.id,
        direction: 'asc',
      }]);
    }
  };

  const handleDeleteAll = () => {
    onDeleteAll();
    onClose();
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSorts = [...sorts];
    const [dragged] = newSorts.splice(draggedIndex, 1);
    newSorts.splice(index, 0, dragged);
    onUpdate(newSorts);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const canAddMore = sorts.length < columns.length;

  return (
    <>
      <div className={styles.popupOverlay} onClick={onClose} />
      <div
        className={styles.sortPopup}
        style={{
          top: anchorRect.bottom + 4,
          left: anchorRect.left,
        }}
      >
        <div className={styles.sortPopupContent}>
          {sorts.map((sort, index) => (
            <div
              key={sort.id}
              className={styles.sortLevel}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <span className={styles.sortDragHandle}>☰</span>
              <select
                className={styles.sortSelect}
                value={sort.columnId}
                onChange={(e) => handleColumnChange(sort.id, e.target.value)}
              >
                {columns.map(col => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
              <select
                className={styles.sortSelect}
                value={sort.direction}
                onChange={(e) => handleDirectionChange(sort.id, e.target.value as 'asc' | 'desc')}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
              <button
                className={styles.sortRemoveBtn}
                onClick={() => handleRemove(sort.id)}
              >
                ×
              </button>
            </div>
          ))}
          {sorts.length === 0 && (
            <div className={styles.sortEmpty}>No sorts applied</div>
          )}
          <div className={styles.sortActions}>
            {canAddMore && (
              <button className={styles.addSortBtn} onClick={handleAdd}>
                + Add sort
              </button>
            )}
            <button className={styles.deleteSortBtn} onClick={handleDeleteAll}>
              Delete sort
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
