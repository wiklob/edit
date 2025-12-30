import type { DatabaseView } from './types';
import { ViewTabs } from './ViewTabs';
import styles from './Database.module.css';

interface TableControlsProps {
  views: DatabaseView[];
  activeViewId: string;
  onSelectView: (viewId: string) => void;
  onAddView: (rect: DOMRect) => void;
  onAddSort: () => void;
  onAddFilter: () => void;
  hasSorts: boolean;
  hasFilters: boolean;
}

export function TableControls({
  views,
  activeViewId,
  onSelectView,
  onAddView,
  onAddSort,
  onAddFilter,
  hasSorts,
  hasFilters,
}: TableControlsProps) {
  return (
    <div className={styles.controlsBar}>
      <ViewTabs
        views={views}
        activeViewId={activeViewId}
        onSelectView={onSelectView}
        onAddView={onAddView}
      />
      <div className={styles.controlsRight}>
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
    </div>
  );
}
