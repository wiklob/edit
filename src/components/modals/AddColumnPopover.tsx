import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { ColumnType } from '../../types';
import styles from './AddColumnPopover.module.css';

const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi-select' },
];

interface AddColumnPopoverProps {
  anchorRect: DOMRect;
  onSelect: (type: ColumnType) => void;
  onClose: () => void;
}

export function AddColumnPopover({ anchorRect, onSelect, onClose }: AddColumnPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Position the popover below the anchor button
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
  };

  return (
    <div className={styles.overlay}>
      <motion.div
        ref={ref}
        className={styles.popover}
        style={style}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.1 }}
      >
        <div className={styles.title}>Select type</div>
        <div className={styles.types}>
          {COLUMN_TYPES.map((type) => (
            <button
              key={type.value}
              className={styles.typeBadge}
              onClick={() => onSelect(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
