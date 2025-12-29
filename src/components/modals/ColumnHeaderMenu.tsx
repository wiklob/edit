import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import styles from './ColumnHeaderMenu.module.css';

interface ColumnHeaderMenuProps {
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ColumnHeaderMenu({ onRename, onDelete, onClose }: ColumnHeaderMenuProps) {
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

  return (
    <motion.div
      ref={ref}
      className={styles.menu}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.1 }}
    >
      <button className={styles.menuItem} onClick={onRename}>
        Rename
      </button>
      <button className={`${styles.menuItem} ${styles.danger}`} onClick={onDelete}>
        Delete
      </button>
    </motion.div>
  );
}
