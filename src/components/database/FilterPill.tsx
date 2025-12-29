import { useRef, useEffect } from 'react';
import type { DatabaseColumn } from '../../types';
import type { Filter } from './types';
import { getOperatorLabel, operatorNeedsValue } from './types';
import styles from './Database.module.css';

interface FilterPillProps {
  filter: Filter;
  columns: DatabaseColumn[];
  onRemove: () => void;
  onClick: (rect: DOMRect) => void;
  autoOpen?: boolean;
}

export function FilterPill({ filter, columns, onRemove, onClick, autoOpen }: FilterPillProps) {
  const ref = useRef<HTMLDivElement>(null);
  const column = columns.find(c => c.id === filter.columnId);
  const operatorLabel = getOperatorLabel(filter.operator);
  const needsValue = operatorNeedsValue(filter.operator);

  // Auto-open popup when this is a new filter
  useEffect(() => {
    if (autoOpen && ref.current) {
      onClick(ref.current.getBoundingClientRect());
    }
  }, [autoOpen, onClick]);

  const handleClick = () => {
    if (ref.current) {
      onClick(ref.current.getBoundingClientRect());
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  // Filter is active if it doesn't need a value (is_empty, is_not_empty) or has a value entered
  const isActive = !needsValue || (needsValue && filter.value.trim() !== '');
  const pillClass = `${styles.pill} ${isActive ? styles.pillActive : ''}`;

  return (
    <div ref={ref} className={pillClass} onClick={handleClick}>
      <span className={styles.pillText}>
        <span className={styles.pillColumn}>{column?.name || 'Unknown'}</span>
        <span className={styles.pillOperator}>{operatorLabel}</span>
        {needsValue && <span className={styles.pillValue}>"{filter.value}"</span>}
      </span>
      <span className={styles.pillDropdown}>▾</span>
      <button className={styles.pillRemove} onClick={handleRemove}>×</button>
    </div>
  );
}
