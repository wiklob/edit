import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { DatabaseColumn } from '../../types';
import styles from './ColumnSettingsPopup.module.css';

interface ColumnSettingsPopupProps {
  column: DatabaseColumn;
  anchorRect: DOMRect;
  onSave: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ColumnSettingsPopup({
  column,
  anchorRect,
  onSave,
  onDelete,
  onClose,
}: ColumnSettingsPopupProps) {
  const [name, setName] = useState(column.name);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input on mount
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleSave();
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
  }, [name, onClose]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) {
      onSave(trimmed);
    } else {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  // Position the popup below the column header
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
  };

  return (
    <div className={styles.overlay}>
      <motion.div
        ref={ref}
        className={styles.popup}
        style={style}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.1 }}
      >
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className={styles.typeInfo}>
          <span className={styles.typeLabel}>Type</span>
          <span className={styles.typeValue}>{getTypeLabel(column.property_type)}</span>
        </div>

        <div className={styles.divider} />

        <button className={styles.deleteBtn} onClick={onDelete}>
          Delete property
        </button>
      </motion.div>
    </div>
  );
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text: 'Text',
    number: 'Number',
    checkbox: 'Checkbox',
    date: 'Date',
    url: 'URL',
    select: 'Select',
    multi_select: 'Multi-select',
  };
  return labels[type] || type;
}
