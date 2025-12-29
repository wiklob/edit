export interface SortLevel {
  id: string;
  columnId: string;
  direction: 'asc' | 'desc';
}

export type FilterOperator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'does_not_contain'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty';

export interface Filter {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: string;
}

export const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'does_not_contain', label: 'does not contain' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

export function getOperatorLabel(operator: FilterOperator): string {
  return FILTER_OPERATORS.find(o => o.value === operator)?.label || operator;
}

export function operatorNeedsValue(operator: FilterOperator): boolean {
  return operator !== 'is_empty' && operator !== 'is_not_empty';
}
