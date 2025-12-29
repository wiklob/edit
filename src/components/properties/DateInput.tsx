import { DatePicker } from './DatePicker';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}

export function DateInput({ value, onChange, onBlur, autoFocus }: DateInputProps) {
  return (
    <DatePicker
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      autoFocus={autoFocus}
    />
  );
}
