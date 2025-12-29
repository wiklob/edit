import styles from './Properties.module.css';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export function TextInput({ value, onChange, onBlur, autoFocus, placeholder }: TextInputProps) {
  return (
    <input
      type="text"
      className={styles.input}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      autoFocus={autoFocus}
      placeholder={placeholder}
    />
  );
}
