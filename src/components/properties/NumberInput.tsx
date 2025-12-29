import styles from './Properties.module.css';

interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export function NumberInput({ value, onChange, onBlur, autoFocus, placeholder }: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Allow empty, numbers, decimals, and negative
    if (newValue === '' || /^-?\d*\.?\d*$/.test(newValue)) {
      onChange(newValue);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className={styles.numberInput}
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
      autoFocus={autoFocus}
      placeholder={placeholder}
    />
  );
}
