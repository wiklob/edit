import type { DatabaseColumn } from '../../types';
import type { SortLevel, Filter } from './types';
import { SortPill } from './SortPill';
import { FilterPill } from './FilterPill';
import styles from './Database.module.css';

interface PillsRowProps {
  sorts: SortLevel[];
  filters: Filter[];
  columns: DatabaseColumn[];
  onOpenSortPopup: (rect: DOMRect) => void;
  onRemoveAllSorts: () => void;
  onRemoveFilter: (filterId: string) => void;
  onOpenFilterPopup: (filterId: string, rect: DOMRect) => void;
  onAddFilter: () => void;
  autoOpenSortPopup?: boolean;
  autoOpenFilterId?: string | null;
  sortPillVisible?: boolean;
}

export function PillsRow({
  sorts,
  filters,
  columns,
  onOpenSortPopup,
  onRemoveAllSorts,
  onRemoveFilter,
  onOpenFilterPopup,
  onAddFilter,
  autoOpenSortPopup,
  autoOpenFilterId,
  sortPillVisible,
}: PillsRowProps) {
  if (!sortPillVisible && filters.length === 0) {
    return null;
  }

  return (
    <div className={styles.pillsRow}>
      <SortPill
        sorts={sorts}
        columns={columns}
        onOpenPopup={onOpenSortPopup}
        onRemoveAll={onRemoveAllSorts}
        autoOpen={autoOpenSortPopup}
        visible={sortPillVisible}
      />
      {sortPillVisible && <div className={styles.pillsDivider} />}
      {filters.map(filter => (
        <FilterPill
          key={filter.id}
          filter={filter}
          columns={columns}
          onRemove={() => onRemoveFilter(filter.id)}
          onClick={(rect) => onOpenFilterPopup(filter.id, rect)}
          autoOpen={autoOpenFilterId === filter.id}
        />
      ))}
      <button className={styles.addFilterPillBtn} onClick={onAddFilter}>
        + Filter
      </button>
    </div>
  );
}
