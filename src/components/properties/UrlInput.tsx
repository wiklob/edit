import styles from './Properties.module.css';

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export function UrlInput({ value, onChange, onBlur, autoFocus, placeholder }: UrlInputProps) {
  return (
    <input
      type="url"
      className={styles.urlInput}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      autoFocus={autoFocus}
      placeholder={placeholder || 'https://...'}
    />
  );
}
