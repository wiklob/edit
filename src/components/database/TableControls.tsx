import styles from './Database.module.css';

interface TableControlsProps {
  onAddSort: () => void;
  onAddFilter: () => void;
  hasSorts: boolean;
  hasFilters: boolean;
}

export function TableControls({ onAddSort, onAddFilter, hasSorts, hasFilters }: TableControlsProps) {
  return (
    <div className={styles.controlsBar}>
      <button
        className={`${styles.controlBtn} ${hasSorts ? styles.controlBtnActive : ''}`}
        onClick={onAddSort}
        title="Sort"
      >
        ↕
      </button>
      <button
        className={`${styles.controlBtn} ${hasFilters ? styles.controlBtnActive : ''}`}
        onClick={onAddFilter}
        title="Filter"
      >
        ⫧
      </button>
    </div>
  );
}
