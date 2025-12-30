import { useEffect, useRef } from 'react';
import type { ViewType } from './types';
import { VIEW_OPTIONS } from './types';
import styles from './Database.module.css';

interface AddViewPopupProps {
  anchorRect: DOMRect;
  onSelect: (type: ViewType) => void;
  onClose: () => void;
}

export function AddViewPopup({ anchorRect, onSelect, onClose }: AddViewPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
  };

  return (
    <div ref={popupRef} className={styles.addViewPopup} style={style}>
      <div className={styles.addViewHeader}>Add a new view</div>
      <div className={styles.addViewOptions}>
        {VIEW_OPTIONS.map(option => (
          <button
            key={option.type}
            className={styles.addViewOption}
            onClick={() => onSelect(option.type)}
          >
            <span className={styles.addViewOptionIcon}>{option.icon}</span>
            <span className={styles.addViewOptionLabel}>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
