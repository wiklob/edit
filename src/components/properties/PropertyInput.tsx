import type { ColumnType, SelectOption } from '../../types';
import { TextInput } from './TextInput';
import { NumberInput } from './NumberInput';
import { CheckboxInput } from './CheckboxInput';
import { DateInput } from './DateInput';
import { UrlInput } from './UrlInput';
import { SelectInput } from './SelectInput';
import { MultiSelectInput } from './MultiSelectInput';

interface PropertyInputProps {
  type: ColumnType;
  value: string;
  options?: SelectOption[] | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export function PropertyInput({
  type,
  value,
  options,
  onChange,
  onBlur,
  autoFocus,
  placeholder,
}: PropertyInputProps) {
  switch (type) {
    case 'number':
      return (
        <NumberInput
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoFocus={autoFocus}
          placeholder={placeholder}
        />
      );

    case 'checkbox':
      return <CheckboxInput value={value} onChange={onChange} />;

    case 'date':
      return (
        <DateInput
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoFocus={autoFocus}
        />
      );

    case 'url':
      return (
        <UrlInput
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoFocus={autoFocus}
          placeholder={placeholder}
        />
      );

    case 'select':
      return (
        <SelectInput
          value={value}
          options={options || []}
          onChange={onChange}
          onBlur={onBlur}
        />
      );

    case 'multi_select':
      return (
        <MultiSelectInput
          value={value}
          options={options || []}
          onChange={onChange}
          onBlur={onBlur}
        />
      );

    case 'text':
    default:
      return (
        <TextInput
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoFocus={autoFocus}
          placeholder={placeholder}
        />
      );
  }
}
