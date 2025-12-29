import { useState, useRef, useEffect } from 'react';
import type { SelectOption } from '../../types';
import styles from './Properties.module.css';

interface MultiSelectInputProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  onBlur?: () => void;
}

function isLightColor(hex: string): boolean {
  const color = hex.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export function MultiSelectInput({ value, options, onChange, onBlur }: MultiSelectInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Parse value as JSON array of IDs
  const selectedIds: string[] = value ? (() => {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  })() : [];

  const selectedOptions = options.filter((o) => selectedIds.includes(o.id));
  const availableOptions = options.filter((o) => !selectedIds.includes(o.id));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        onBlur?.();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onBlur]);

  const handleAdd = (optionId: string) => {
    const newIds = [...selectedIds, optionId];
    onChange(JSON.stringify(newIds));
  };

  const handleRemove = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== optionId);
    onChange(newIds.length > 0 ? JSON.stringify(newIds) : '');
  };

  return (
    <div className={styles.multiSelect} ref={ref}>
      <div className={styles.multiSelectTags} onClick={() => setIsOpen(!isOpen)}>
        {selectedOptions.length > 0 ? (
          selectedOptions.map((option) => (
            <span
              key={option.id}
              className={`${styles.optionTag} ${option.color && isLightColor(option.color) ? styles.optionTagLight : ''}`}
              style={{ backgroundColor: option.color || '#6b7280' }}
            >
              {option.label}
              <span className={styles.tagRemove} onClick={(e) => handleRemove(option.id, e)}>
                ×
              </span>
            </span>
          ))
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
      {isOpen && (
        <div className={styles.selectDropdown}>
          {availableOptions.length > 0 ? (
            availableOptions.map((option) => (
              <div
                key={option.id}
                className={styles.selectOption}
                onClick={() => handleAdd(option.id)}
              >
                <span
                  className={`${styles.optionTag} ${option.color && isLightColor(option.color) ? styles.optionTagLight : ''}`}
                  style={{ backgroundColor: option.color || '#6b7280' }}
                >
                  {option.label}
                </span>
              </div>
            ))
          ) : (
            <div className={styles.selectOption} style={{ color: 'var(--color-text-tertiary)' }}>
              No more options
            </div>
          )}
        </div>
      )}
    </div>
  );
}
