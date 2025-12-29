import { useRef, useEffect } from 'react';
import type { DatabaseColumn } from '../../types';
import type { SortLevel } from './types';
import styles from './Database.module.css';

interface SortPillProps {
  sorts: SortLevel[];
  columns: DatabaseColumn[];
  onOpenPopup: (rect: DOMRect) => void;
  onRemoveAll: () => void;
  autoOpen?: boolean;
  visible?: boolean;
}

export function SortPill({ sorts, columns, onOpenPopup, onRemoveAll, autoOpen, visible }: SortPillProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Auto-open popup when requested
  useEffect(() => {
    if (autoOpen && ref.current) {
      onOpenPopup(ref.current.getBoundingClientRect());
    }
  }, [autoOpen, onOpenPopup]);

  if (!visible) return null;

  const handleClick = () => {
    if (ref.current) {
      onOpenPopup(ref.current.getBoundingClientRect());
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveAll();
  };

  const isActive = sorts.length > 0;
  const pillClass = `${styles.pill} ${isActive ? styles.pillActive : ''}`;

  if (sorts.length === 0) {
    return (
      <div ref={ref} className={pillClass} onClick={handleClick}>
        <span className={styles.pillText}>
          <span className={styles.pillColumn}>0 sorts</span>
        </span>
        <span className={styles.pillDropdown}>▾</span>
        <button className={styles.pillRemove} onClick={handleRemove}>×</button>
      </div>
    );
  }

  // For single sort, show column name and direction
  // For multiple sorts, show "n sorts"
  const isSingle = sorts.length === 1;
  const primarySort = sorts[0];
  const primaryColumn = columns.find(c => c.id === primarySort.columnId);

  return (
    <div ref={ref} className={pillClass} onClick={handleClick}>
      <span className={styles.pillText}>
        {isSingle ? (
          <>
            <span className={styles.pillColumn}>{primaryColumn?.name || 'Unknown'}</span>
            <span>{primarySort.direction === 'asc' ? '↑' : '↓'}</span>
          </>
        ) : (
          <span className={styles.pillColumn}>{sorts.length} sorts</span>
        )}
      </span>
      <span className={styles.pillDropdown}>▾</span>
      <button className={styles.pillRemove} onClick={handleRemove}>×</button>
    </div>
  );
}
