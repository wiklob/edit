import { useRef } from 'react';
import type { SelectOption } from '../../types';
import styles from './Properties.module.css';

interface SelectInputProps {
  value: string;
  options: SelectOption[];
  onClick: (element: HTMLElement) => void;
}

function isLightColor(hex: string): boolean {
  const color = hex.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export function SelectInput({ value, options, onClick }: SelectInputProps) {
  const ref = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o) => o.id === value);

  const handleClick = () => {
    if (ref.current) {
      onClick(ref.current);
    }
  };

  return (
    <div className={styles.select} ref={ref}>
      <div className={styles.selectTrigger} onClick={handleClick}>
        {selectedOption ? (
          <span
            className={`${styles.optionTag} ${selectedOption.color && isLightColor(selectedOption.color) ? styles.optionTagLight : ''}`}
            style={{ backgroundColor: selectedOption.color || '#6b7280' }}
          >
            {selectedOption.label}
          </span>
        ) : (
          <span className={styles.selectPlaceholder}></span>
        )}
      </div>
    </div>
  );
}
