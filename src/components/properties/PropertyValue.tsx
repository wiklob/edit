import type { ColumnType, SelectOption } from '../../types';
import styles from './Properties.module.css';

interface PropertyValueProps {
  type: ColumnType;
  value: string | null;
  options?: SelectOption[] | null;
  onClick?: () => void;
  emptyText?: string;
}

function isLightColor(hex: string): boolean {
  const color = hex.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function PropertyValue({ type, value, options, onClick, emptyText = '' }: PropertyValueProps) {
  if (!value) {
    return (
      <span className={`${styles.value} ${styles.valueEmpty}`} onClick={onClick}>
        {emptyText}
      </span>
    );
  }

  switch (type) {
    case 'checkbox':
      return (
        <span className={`${styles.value} ${styles.valueCheckbox}`} onClick={onClick}>
          {value === 'true' ? '☑' : '☐'}
        </span>
      );

    case 'date':
      return (
        <span className={styles.value} onClick={onClick}>
          {formatDate(value)}
        </span>
      );

    case 'url':
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.valueUrl}
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      );

    case 'select': {
      const option = options?.find((o) => o.id === value);
      if (!option) {
        return (
          <span className={`${styles.value} ${styles.valueEmpty}`} onClick={onClick}>
            {emptyText}
          </span>
        );
      }
      return (
        <span className={styles.value} onClick={onClick}>
          <span
            className={`${styles.optionTag} ${option.color && isLightColor(option.color) ? styles.optionTagLight : ''}`}
            style={{ backgroundColor: option.color || '#6b7280' }}
          >
            {option.label}
          </span>
        </span>
      );
    }

    case 'multi_select': {
      let selectedIds: string[] = [];
      try {
        selectedIds = JSON.parse(value);
      } catch {
        selectedIds = [];
      }
      const selectedOptions = options?.filter((o) => selectedIds.includes(o.id)) || [];
      if (selectedOptions.length === 0) {
        return (
          <span className={`${styles.value} ${styles.valueEmpty}`} onClick={onClick}>
            {emptyText}
          </span>
        );
      }
      return (
        <span className={styles.value} onClick={onClick} style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {selectedOptions.map((option) => (
            <span
              key={option.id}
              className={`${styles.optionTag} ${option.color && isLightColor(option.color) ? styles.optionTagLight : ''}`}
              style={{ backgroundColor: option.color || '#6b7280' }}
            >
              {option.label}
            </span>
          ))}
        </span>
      );
    }

    case 'number':
    case 'text':
    default:
      return (
        <span className={styles.value} onClick={onClick}>
          {value}
        </span>
      );
  }
}
