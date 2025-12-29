import styles from './Properties.module.css';

interface CheckboxInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function CheckboxInput({ value, onChange }: CheckboxInputProps) {
  const checked = value === 'true';

  const handleChange = () => {
    onChange(checked ? 'false' : 'true');
  };

  return (
    <div className={styles.checkboxWrapper}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        onChange={handleChange}
      />
    </div>
  );
}
