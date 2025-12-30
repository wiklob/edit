import { useRef } from 'react';
import type { DatabaseView } from './types';
import { getViewIcon } from './types';
import styles from './Database.module.css';

interface ViewTabsProps {
  views: DatabaseView[];
  activeViewId: string;
  onSelectView: (viewId: string) => void;
  onAddView: (rect: DOMRect) => void;
}

export function ViewTabs({ views, activeViewId, onSelectView, onAddView }: ViewTabsProps) {
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const handleAddClick = () => {
    if (addBtnRef.current) {
      onAddView(addBtnRef.current.getBoundingClientRect());
    }
  };

  return (
    <div className={styles.viewTabs}>
      {views.map(view => (
        <button
          key={view.id}
          className={`${styles.viewTab} ${view.id === activeViewId ? styles.viewTabActive : ''}`}
          onClick={() => onSelectView(view.id)}
        >
          <span className={styles.viewTabIcon}>{getViewIcon(view.type)}</span>
          <span className={styles.viewTabName}>{view.name}</span>
        </button>
      ))}
      <button
        ref={addBtnRef}
        className={styles.addViewBtn}
        onClick={handleAddClick}
        title="Add view"
      >
        +
      </button>
    </div>
  );
}
