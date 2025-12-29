import { useState, useRef, useEffect } from 'react';
import type { SelectOption } from '../../types';
import styles from './Properties.module.css';

interface SelectInputProps {
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

export function SelectInput({ value, options, onChange, onBlur }: SelectInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value);

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

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    onBlur?.();
  };

  return (
    <div className={styles.select} ref={ref}>
      <div className={styles.selectTrigger} onClick={() => setIsOpen(!isOpen)}>
        {selectedOption ? (
          <span
            className={`${styles.optionTag} ${selectedOption.color && isLightColor(selectedOption.color) ? styles.optionTagLight : ''}`}
            style={{ backgroundColor: selectedOption.color || '#6b7280' }}
          >
            {selectedOption.label}
          </span>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
      {isOpen && (
        <div className={styles.selectDropdown}>
          {options.map((option) => (
            <div
              key={option.id}
              className={`${styles.selectOption} ${option.id === value ? styles.selectOptionSelected : ''}`}
              onClick={() => handleSelect(option.id)}
            >
              <span
                className={`${styles.optionTag} ${option.color && isLightColor(option.color) ? styles.optionTagLight : ''}`}
                style={{ backgroundColor: option.color || '#6b7280' }}
              >
                {option.label}
              </span>
            </div>
          ))}
          {value && (
            <div
              className={styles.selectOption}
              onClick={() => handleSelect('')}
            >
              <span style={{ color: 'var(--color-text-tertiary)' }}>Clear</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
