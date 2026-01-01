import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { IconPicker, PageIcon } from '../components/common';
import { AddColumnPopover, ColumnSettingsPopup } from '../components/modals';
import { PropertyInput, PropertyValue, SelectPopup } from '../components/properties';
import {
  TableControls,
  PillsRow,
  SortPopup,
  FilterPopup,
  AddViewPopup,
  ListView,
  GalleryView,
  BoardView,
  type SortLevel,
  type Filter,
  type DatabaseView,
  type ViewType,
  getViewLabel,
} from '../components/database';
import { supabase, useBreadcrumbs, useSidebar } from '../lib';
import type { Page, DatabaseColumn, PageWithProperties, ColumnType } from '../types';
import styles from './Page.module.css';

// Default column widths
const DEFAULT_WIDTH = 150;
const CHECKBOX_WIDTH = 80;
const TITLE_WIDTH = 200;
const MIN_WIDTH = 50;

const getDefaultWidth = (type: ColumnType): number => {
  return type === 'checkbox' ? CHECKBOX_WIDTH : DEFAULT_WIDTH;
};

interface DatabasePageProps {
  page: Page;
}

export function DatabasePage({ page }: DatabasePageProps) {
  const { id: sectionId } = useParams<{ id: string }>();
  const { breadcrumbs, setBreadcrumbs } = useBreadcrumbs();
  const { updatePageIcon } = useSidebar();
  const [pageIcon, setPageIcon] = useState(page.icon);
  const [pageName, setPageName] = useState(page.name);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(page.name);
  const [columns, setColumns] = useState<DatabaseColumn[]>([]);
  const [rows, setRows] = useState<PageWithProperties[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRowTitle, setEditingRowTitle] = useState<string | null>(null);
  const [editRowTitleValue, setEditRowTitleValue] = useState('');
  const [editingProperty, setEditingProperty] = useState<{ rowId: string; columnId: string } | null>(null);
  const [editPropertyValue, setEditPropertyValue] = useState('');
  const [addColumnAnchor, setAddColumnAnchor] = useState<DOMRect | null>(null);
  const [settingsColumn, setSettingsColumn] = useState<{ column: DatabaseColumn; rect: DOMRect } | null>(null);
  const [titleWidth, setTitleWidth] = useState(TITLE_WIDTH);
  const [resizing, setResizing] = useState<{ columnId: string | 'title'; startX: number; startWidth: number } | null>(null);
  const [sorts, setSorts] = useState<SortLevel[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sortPopupAnchor, setSortPopupAnchor] = useState<DOMRect | null>(null);
  const [autoOpenSortPopup, setAutoOpenSortPopup] = useState(false);
  const [sortPillVisible, setSortPillVisible] = useState(false);
  const [editingFilter, setEditingFilter] = useState<{ filter: Filter; rect: DOMRect } | null>(null);
  const [autoOpenFilterId, setAutoOpenFilterId] = useState<string | null>(null);
  const [views, setViews] = useState<DatabaseView[]>([
    { id: 'default', name: 'Table', type: 'table' },
  ]);
  const [activeViewId, setActiveViewId] = useState('default');
  const [addViewPopupAnchor, setAddViewPopupAnchor] = useState<DOMRect | null>(null);
  const [selectPopup, setSelectPopup] = useState<{
    rowId: string;
    columnId: string;
    anchorElement: HTMLElement;
  } | null>(null);
  const addColumnBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch columns
      const { data: columnsData } = await supabase
        .from('database_columns')
        .select('*')
        .eq('page_id', page.id)
        .order('display_order');

      if (columnsData) {
        setColumns(columnsData);
      }

      // Fetch rows (text pages with this database as parent)
      const { data: rowsData } = await supabase
        .from('pages')
        .select('*, properties:page_properties(*, column:database_columns(*))')
        .eq('parent_id', page.id)
        .order('display_order');

      if (rowsData) {
        setRows(rowsData as unknown as PageWithProperties[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [page.id]);

  // Virtual Title column for sort/filter
  const TITLE_COLUMN_ID = '__title__';
  const sortableColumns = useMemo(() => {
    const titleColumn: DatabaseColumn = {
      id: TITLE_COLUMN_ID,
      page_id: page.id,
      name: 'Title',
      property_type: 'text',
      display_order: -1,
      created_at: '',
    };
    return [titleColumn, ...columns.filter(c => c.name !== 'Title')];
  }, [columns, page.id]);

  // Filter and sort rows
  const processedRows = useMemo(() => {
    let result = [...rows];

    // Apply filters
    if (filters.length > 0) {
      result = result.filter(row => {
        return filters.every(filter => {
          // Handle Title column specially
          const value = filter.columnId === TITLE_COLUMN_ID
            ? row.name
            : (row.properties.find(p => p.column_id === filter.columnId)?.value || '');

          switch (filter.operator) {
            case 'is':
              return value.toLowerCase() === filter.value.toLowerCase();
            case 'is_not':
              return value.toLowerCase() !== filter.value.toLowerCase();
            case 'contains':
              return value.toLowerCase().includes(filter.value.toLowerCase());
            case 'does_not_contain':
              return !value.toLowerCase().includes(filter.value.toLowerCase());
            case 'starts_with':
              return value.toLowerCase().startsWith(filter.value.toLowerCase());
            case 'ends_with':
              return value.toLowerCase().endsWith(filter.value.toLowerCase());
            case 'is_empty':
              return !value || value === '' || value === '[]';
            case 'is_not_empty':
              return value && value !== '' && value !== '[]';
            default:
              return true;
          }
        });
      });
    }

    // Apply sorts
    if (sorts.length > 0) {
      result.sort((a, b) => {
        for (const sort of sorts) {
          // Handle Title column specially
          let valueA: string;
          let valueB: string;
          let column: DatabaseColumn | undefined;

          if (sort.columnId === TITLE_COLUMN_ID) {
            valueA = a.name;
            valueB = b.name;
            column = { property_type: 'text' } as DatabaseColumn;
          } else {
            const propA = a.properties.find(p => p.column_id === sort.columnId);
            const propB = b.properties.find(p => p.column_id === sort.columnId);
            valueA = propA?.value || '';
            valueB = propB?.value || '';
            column = columns.find(c => c.id === sort.columnId);
          }

          let comparison = 0;

          if (column?.property_type === 'number') {
            const numA = parseFloat(valueA) || 0;
            const numB = parseFloat(valueB) || 0;
            comparison = numA - numB;
          } else if (column?.property_type === 'date') {
            const dateA = new Date(valueA || 0).getTime();
            const dateB = new Date(valueB || 0).getTime();
            comparison = dateA - dateB;
          } else if (column?.property_type === 'checkbox') {
            comparison = (valueA === 'true' ? 1 : 0) - (valueB === 'true' ? 1 : 0);
          } else {
            comparison = valueA.localeCompare(valueB);
          }

          if (comparison !== 0) {
            return sort.direction === 'asc' ? comparison : -comparison;
          }
        }
        return 0;
      });
    }

    return result;
  }, [rows, filters, sorts, columns]);

  // Sort/Filter handlers
  const handleSortButtonClick = () => {
    setSortPillVisible(true);
    if (sorts.length === 0) {
      // Add first sort with Title, then auto-open popup at pill
      setSorts([{
        id: crypto.randomUUID(),
        columnId: TITLE_COLUMN_ID,
        direction: 'asc',
      }]);
    }
    setAutoOpenSortPopup(true);
  };

  const handleOpenSortPopup = (rect: DOMRect) => {
    setSortPopupAnchor(rect);
    setAutoOpenSortPopup(false);
  };

  const handleDeleteAllSorts = () => {
    setSorts([]);
    setSortPopupAnchor(null);
    setSortPillVisible(false);
    setAutoOpenSortPopup(false);
  };

  const handleFilterButtonClick = () => {
    // Add a new filter with defaults, then auto-open popup at pill
    const newFilter: Filter = {
      id: crypto.randomUUID(),
      columnId: sortableColumns[0]?.id || '',
      operator: 'contains',
      value: '',
    };
    setFilters([...filters, newFilter]);
    setAutoOpenFilterId(newFilter.id);
  };

  const handleOpenFilterPopup = (filterId: string, rect: DOMRect) => {
    const filter = filters.find(f => f.id === filterId);
    if (filter) {
      setEditingFilter({ filter, rect });
    }
    setAutoOpenFilterId(null);
  };

  const handleSaveFilter = (filter: Filter) => {
    setFilters(filters.map(f => f.id === filter.id ? filter : f));
  };

  const handleRemoveFilter = (filterId: string) => {
    setFilters(filters.filter(f => f.id !== filterId));
  };

  // View handlers
  const activeView = useMemo(() => {
    return views.find(v => v.id === activeViewId) || views[0];
  }, [views, activeViewId]);

  const handleSelectView = (viewId: string) => {
    setActiveViewId(viewId);
  };

  const handleAddViewClick = (rect: DOMRect) => {
    setAddViewPopupAnchor(rect);
  };

  const handleAddView = (type: ViewType) => {
    const newView: DatabaseView = {
      id: crypto.randomUUID(),
      name: getViewLabel(type),
      type,
    };
    setViews([...views, newView]);
    setActiveViewId(newView.id);
    setAddViewPopupAnchor(null);
  };

  // Handler for updating row name (used by list/gallery/board views)
  const handleUpdateRowName = async (rowId: string, newName: string) => {
    const { error } = await supabase
      .from('pages')
      .update({ name: newName })
      .eq('id', rowId);

    if (!error) {
      setRows(rows.map(row =>
        row.id === rowId ? { ...row, name: newName } : row
      ));
    }
  };

  // Handler for updating property (used by board view drag & drop)
  const handleUpdateProperty = async (rowId: string, columnId: string, value: string) => {
    const { error } = await supabase
      .from('page_properties')
      .update({ value })
      .eq('page_id', rowId)
      .eq('column_id', columnId);

    if (!error) {
      setRows(rows.map(row => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          properties: row.properties.map(prop =>
            prop.column_id === columnId ? { ...prop, value } : prop
          ),
        };
      }));
    }
  };

  const handleStartEditTitle = () => {
    setIsEditingTitle(true);
    setEditTitleValue(pageName);
  };

  const handleSaveTitle = async () => {
    const newName = editTitleValue.trim();
    if (newName && newName !== pageName) {
      const { error } = await supabase
        .from('pages')
        .update({ name: newName })
        .eq('id', page.id);

      if (!error) {
        setPageName(newName);
        // Update breadcrumbs
        const updated = [...breadcrumbs];
        if (updated.length > 0) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], label: newName };
        }
        setBreadcrumbs(updated);
      }
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const handleIconChange = async (newIcon: string) => {
    const { error } = await supabase
      .from('pages')
      .update({ icon: newIcon })
      .eq('id', page.id);

    if (!error) {
      setPageIcon(newIcon);
      updatePageIcon(page.id, newIcon);
      // Update breadcrumbs
      const updated = [...breadcrumbs];
      if (updated.length > 0) {
        updated[updated.length - 1] = { ...updated[updated.length - 1], icon: newIcon };
      }
      setBreadcrumbs(updated);
    }
  };

  const handleRemoveIcon = async () => {
    const { error } = await supabase
      .from('pages')
      .update({ icon: null })
      .eq('id', page.id);

    if (!error) {
      setPageIcon(null);
      updatePageIcon(page.id, null);
      // Update breadcrumbs
      const updated = [...breadcrumbs];
      if (updated.length > 0) {
        updated[updated.length - 1] = { ...updated[updated.length - 1], icon: null };
      }
      setBreadcrumbs(updated);
    }
  };

  const handleAddRow = async () => {
    const { data, error } = await supabase
      .from('pages')
      .insert({
        section_id: page.section_id,
        parent_id: page.id,
        type: 'text',
        name: 'Untitled',
      })
      .select()
      .single();

    if (data && !error) {
      // Create page_properties entries for all existing columns
      if (columns.length > 0) {
        const propertiesToInsert = columns.map(col => ({
          page_id: data.id,
          column_id: col.id,
          value: null,
        }));

        await supabase.from('page_properties').insert(propertiesToInsert);
      }

      // Fetch the row with its properties
      const { data: rowWithProperties } = await supabase
        .from('pages')
        .select('*, properties:page_properties(*, column:database_columns(*))')
        .eq('id', data.id)
        .single();

      if (rowWithProperties) {
        setRows([...rows, rowWithProperties as unknown as PageWithProperties]);
      }
    }
  };

  const getPropertyValue = (row: PageWithProperties, columnId: string): string => {
    const prop = row.properties.find(p => p.column_id === columnId);
    return prop?.value || '';
  };

  const handleStartEditProperty = (rowId: string, columnId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (row) {
      setEditingProperty({ rowId, columnId });
      setEditPropertyValue(getPropertyValue(row, columnId));
    }
  };

  const handleSaveProperty = async () => {
    if (!editingProperty) return;
    const { rowId, columnId } = editingProperty;

    const { error } = await supabase
      .from('page_properties')
      .update({ value: editPropertyValue })
      .eq('page_id', rowId)
      .eq('column_id', columnId);

    if (!error) {
      setRows(rows.map(row => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          properties: row.properties.map(prop =>
            prop.column_id === columnId ? { ...prop, value: editPropertyValue } : prop
          ),
        };
      }));
    }
    setEditingProperty(null);
  };

  // For immediate-save types (checkbox, select, multi_select), save on change
  const handleImmediateSave = async (rowId: string, columnId: string, value: string) => {
    const { error } = await supabase
      .from('page_properties')
      .update({ value })
      .eq('page_id', rowId)
      .eq('column_id', columnId);

    if (!error) {
      setRows(rows.map(row => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          properties: row.properties.map(prop =>
            prop.column_id === columnId ? { ...prop, value } : prop
          ),
        };
      }));
    }
  };

  const isImmediateSaveType = (type: ColumnType) => {
    return type === 'checkbox' || type === 'select' || type === 'multi_select' || type === 'date';
  };

  // Select popup handlers
  const handleOpenSelectPopup = (rowId: string, columnId: string, anchorElement: HTMLElement) => {
    setSelectPopup({ rowId, columnId, anchorElement });
  };

  const handleSelectValue = async (value: string) => {
    if (!selectPopup) return;
    const { rowId, columnId } = selectPopup;
    await handleImmediateSave(rowId, columnId, value);
  };

  // Handler for creating new select options
  const handleCreateSelectOption = async (columnId: string, newOption: { id: string; label: string; color?: string }) => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;

    const currentOptions = column.options || [];
    const updatedOptions = [...currentOptions, newOption];

    const { error } = await supabase
      .from('database_columns')
      .update({ options: updatedOptions })
      .eq('id', columnId);

    if (!error) {
      // Update local columns state
      setColumns(columns.map(c =>
        c.id === columnId ? { ...c, options: updatedOptions } : c
      ));
      // Update column references in rows
      setRows(rows.map(row => ({
        ...row,
        properties: row.properties.map(prop =>
          prop.column_id === columnId
            ? { ...prop, column: { ...prop.column, options: updatedOptions } }
            : prop
        ),
      })));
    }
  };

  // Handler for updating select options (rename, change color)
  const handleUpdateSelectOption = async (columnId: string, updatedOption: { id: string; label: string; color?: string }) => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;

    const currentOptions = column.options || [];
    const updatedOptions = currentOptions.map(opt =>
      opt.id === updatedOption.id ? updatedOption : opt
    );

    const { error } = await supabase
      .from('database_columns')
      .update({ options: updatedOptions })
      .eq('id', columnId);

    if (!error) {
      setColumns(columns.map(c =>
        c.id === columnId ? { ...c, options: updatedOptions } : c
      ));
      setRows(rows.map(row => ({
        ...row,
        properties: row.properties.map(prop =>
          prop.column_id === columnId
            ? { ...prop, column: { ...prop.column, options: updatedOptions } }
            : prop
        ),
      })));
    }
  };

  // Handler for deleting select options
  const handleDeleteSelectOption = async (columnId: string, optionId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;

    const currentOptions = column.options || [];
    const updatedOptions = currentOptions.filter(opt => opt.id !== optionId);

    const { error } = await supabase
      .from('database_columns')
      .update({ options: updatedOptions })
      .eq('id', columnId);

    if (!error) {
      setColumns(columns.map(c =>
        c.id === columnId ? { ...c, options: updatedOptions } : c
      ));
      setRows(rows.map(row => ({
        ...row,
        properties: row.properties.map(prop =>
          prop.column_id === columnId
            ? { ...prop, column: { ...prop.column, options: updatedOptions } }
            : prop
        ),
      })));

      // Clear property values that used this option
      const rowsWithOption = rows.filter(row =>
        row.properties.some(p => p.column_id === columnId && p.value === optionId)
      );
      for (const row of rowsWithOption) {
        await handleImmediateSave(row.id, columnId, '');
      }
    }
  };

  // Handler for reordering select options
  const handleReorderSelectOptions = async (columnId: string, newOptions: { id: string; label: string; color?: string }[]) => {
    const { error } = await supabase
      .from('database_columns')
      .update({ options: newOptions })
      .eq('id', columnId);

    if (!error) {
      setColumns(columns.map(c =>
        c.id === columnId ? { ...c, options: newOptions } : c
      ));
      setRows(rows.map(row => ({
        ...row,
        properties: row.properties.map(prop =>
          prop.column_id === columnId
            ? { ...prop, column: { ...prop.column, options: newOptions } }
            : prop
        ),
      })));
    }
  };

  // Get display name for column type
  const getTypeLabel = (type: ColumnType): string => {
    const labels: Record<ColumnType, string> = {
      text: 'Text',
      number: 'Number',
      checkbox: 'Checkbox',
      date: 'Date',
      url: 'URL',
      select: 'Select',
      multi_select: 'Multi-select',
    };
    return labels[type];
  };

  const handleCreateColumn = async (type: ColumnType) => {
    const defaultName = getTypeLabel(type);
    const defaultWidth = getDefaultWidth(type);
    const maxOrder = columns.length > 0
      ? Math.max(...columns.map(c => c.display_order))
      : 0;

    const { data, error } = await supabase
      .from('database_columns')
      .insert({
        page_id: page.id,
        name: defaultName,
        property_type: type,
        width: defaultWidth,
        display_order: maxOrder + 1,
      })
      .select()
      .single();

    if (data && !error) {
      setColumns([...columns, data]);
      setAddColumnAnchor(null);

      // Create page_properties for existing rows
      if (rows.length > 0) {
        const propertiesToInsert = rows.map(row => ({
          page_id: row.id,
          column_id: data.id,
          value: null,
        }));

        await supabase
          .from('page_properties')
          .insert(propertiesToInsert);

        // Update local rows state with new empty properties
        setRows(rows.map(row => ({
          ...row,
          properties: [
            ...row.properties,
            {
              id: crypto.randomUUID(),
              page_id: row.id,
              column_id: data.id,
              value: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              column: data,
            },
          ],
        })));
      }

      // Open settings popup for the new column to edit name
      // We need to wait for render to get the header rect
      setTimeout(() => {
        const headerEl = document.querySelector(`[data-column-id="${data.id}"]`);
        if (headerEl) {
          setSettingsColumn({ column: data, rect: headerEl.getBoundingClientRect() });
        }
      }, 50);
    }
  };

  const handleOpenColumnSettings = (column: DatabaseColumn, headerEl: HTMLElement) => {
    setSettingsColumn({ column, rect: headerEl.getBoundingClientRect() });
  };

  const handleSaveColumnName = async (columnId: string, newName: string) => {
    const { error } = await supabase
      .from('database_columns')
      .update({ name: newName })
      .eq('id', columnId);

    if (!error) {
      setColumns(columns.map(c =>
        c.id === columnId ? { ...c, name: newName } : c
      ));
      // Update column references in rows
      setRows(rows.map(row => ({
        ...row,
        properties: row.properties.map(prop =>
          prop.column_id === columnId
            ? { ...prop, column: { ...prop.column, name: newName } }
            : prop
        ),
      })));
    }
    setSettingsColumn(null);
  };

  const handleDeleteColumn = async (columnId: string) => {
    const { error } = await supabase
      .from('database_columns')
      .delete()
      .eq('id', columnId);

    if (!error) {
      setColumns(columns.filter(c => c.id !== columnId));
      // Remove properties for this column from rows
      setRows(rows.map(row => ({
        ...row,
        properties: row.properties.filter(prop => prop.column_id !== columnId),
      })));
    }
    setSettingsColumn(null);
  };

  const handleAddColumnClick = () => {
    if (addColumnBtnRef.current) {
      setAddColumnAnchor(addColumnBtnRef.current.getBoundingClientRect());
    }
  };

  // Get column width (from DB or default)
  const getColumnWidth = (column: DatabaseColumn): number => {
    return column.width ?? getDefaultWidth(column.property_type);
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, columnId: string | 'title', currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ columnId, startX: e.clientX, startWidth: currentWidth });
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    const delta = e.clientX - resizing.startX;
    const newWidth = Math.max(MIN_WIDTH, resizing.startWidth + delta);

    if (resizing.columnId === 'title') {
      setTitleWidth(newWidth);
    } else {
      setColumns(cols => cols.map(col =>
        col.id === resizing.columnId ? { ...col, width: newWidth } : col
      ));
    }
  }, [resizing]);

  const handleResizeEnd = useCallback(async () => {
    if (!resizing) return;

    // Save width to database
    if (resizing.columnId !== 'title') {
      const column = columns.find(c => c.id === resizing.columnId);
      if (column) {
        await supabase
          .from('database_columns')
          .update({ width: column.width })
          .eq('id', resizing.columnId);
      }
    }
    // Note: title width is not persisted (you could add a page setting for this)

    setResizing(null);
  }, [resizing, columns]);

  // Attach global mouse events for resize
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);

  const handleStartEditRowTitle = (row: PageWithProperties) => {
    setEditingRowTitle(row.id);
    setEditRowTitleValue(row.name);
  };

  const handleSaveRowTitle = async (rowId: string) => {
    if (editRowTitleValue.trim()) {
      const newName = editRowTitleValue.trim();

      // Update page name
      const { error } = await supabase
        .from('pages')
        .update({ name: newName })
        .eq('id', rowId);

      if (!error) {
        // Also update the Title property to keep them in sync
        const titleColumn = columns.find(c => c.name === 'Title');
        if (titleColumn) {
          await supabase
            .from('page_properties')
            .update({ value: newName })
            .eq('page_id', rowId)
            .eq('column_id', titleColumn.id);
        }

        setRows(rows.map(row => {
          if (row.id !== rowId) return row;
          return {
            ...row,
            name: newName,
            properties: row.properties.map(prop =>
              prop.column?.name === 'Title' ? { ...prop, value: newName } : prop
            ),
          };
        }));
      }
    }
    setEditingRowTitle(null);
  };

  const handleRowTitleKeyDown = (e: React.KeyboardEvent, rowId: string) => {
    if (e.key === 'Enter') {
      handleSaveRowTitle(rowId);
    } else if (e.key === 'Escape') {
      setEditingRowTitle(null);
    }
  };

  return (
    <div className={styles.content}>
      <div className={styles.titleRow}>
        <IconPicker icon={pageIcon} onSelect={handleIconChange} onRemove={pageIcon ? handleRemoveIcon : undefined} size="small" />
        {isEditingTitle ? (
          <input
            type="text"
            value={editTitleValue}
            onChange={(e) => setEditTitleValue(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleTitleKeyDown}
            className={styles.pageTitleInput}
            autoFocus
          />
        ) : (
          <h1 className={styles.pageTitle} onClick={handleStartEditTitle}>
            {pageName}
          </h1>
        )}
      </div>
      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <>
          <TableControls
            views={views}
            activeViewId={activeViewId}
            onSelectView={handleSelectView}
            onAddView={handleAddViewClick}
            onAddSort={handleSortButtonClick}
            onAddFilter={handleFilterButtonClick}
            hasSorts={sorts.length > 0}
            hasFilters={filters.length > 0}
          />
          <PillsRow
            sorts={sorts}
            filters={filters}
            columns={sortableColumns}
            onOpenSortPopup={handleOpenSortPopup}
            onRemoveAllSorts={handleDeleteAllSorts}
            onRemoveFilter={handleRemoveFilter}
            onOpenFilterPopup={handleOpenFilterPopup}
            onAddFilter={handleFilterButtonClick}
            autoOpenSortPopup={autoOpenSortPopup}
            autoOpenFilterId={autoOpenFilterId}
            sortPillVisible={sortPillVisible}
          />
          {activeView.type === 'table' && (
            <div className={styles.tableWrapper}>
              <div className={styles.tableInner}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.titleColumn} style={{ width: titleWidth }}>
                      Title
                      <div
                        className={`${styles.resizeHandle} ${resizing?.columnId === 'title' ? styles.resizing : ''}`}
                        onMouseDown={(e) => handleResizeStart(e, 'title', titleWidth)}
                      />
                    </th>
                    {columns.filter(c => c.name !== 'Title').map((column) => {
                      const width = getColumnWidth(column);
                      return (
                        <th
                          key={column.id}
                          data-column-id={column.id}
                          className={styles.columnHeader}
                          style={{ width }}
                          onClick={(e) => {
                            // Don't open settings if clicking on resize handle
                            if ((e.target as HTMLElement).classList.contains(styles.resizeHandle)) return;
                            handleOpenColumnSettings(column, e.currentTarget);
                          }}
                        >
                          {column.name}
                          <div
                            className={`${styles.resizeHandle} ${resizing?.columnId === column.id ? styles.resizing : ''}`}
                            onMouseDown={(e) => handleResizeStart(e, column.id, width)}
                          />
                        </th>
                      );
                    })}
                    <th className={styles.addColumnHeader}>
                      <button
                        ref={addColumnBtnRef}
                        className={styles.addColumnBtn}
                        onClick={handleAddColumnClick}
                      >
                        +
                      </button>
                    </th>
                    <th className={styles.spacerColumn}></th>
                  </tr>
                </thead>
                <tbody>
                  {processedRows.map((row) => (
                    <tr key={row.id}>
                      <td className={styles.titleCell} style={{ width: titleWidth }}>
                        <div className={styles.titleWrapper}>
                          <span className={styles.rowIcon}>
                            <PageIcon icon={row.icon || 'lucide:file-text:default'} size={14} />
                          </span>
                          {editingRowTitle === row.id ? (
                            <input
                              type="text"
                              value={editRowTitleValue}
                              onChange={(e) => setEditRowTitleValue(e.target.value)}
                              onBlur={() => handleSaveRowTitle(row.id)}
                              onKeyDown={(e) => handleRowTitleKeyDown(e, row.id)}
                              className={styles.titleInput}
                              autoFocus
                            />
                          ) : (
                            <span
                              className={styles.titleText}
                              onClick={() => handleStartEditRowTitle(row)}
                            >
                              {row.name}
                            </span>
                          )}
                          <Link
                            to={`/section/${sectionId}/page/${row.id}`}
                            className={styles.openBtn}
                          >
                            Open
                          </Link>
                        </div>
                      </td>
                      {columns.filter(c => c.name !== 'Title').map((column) => {
                        const isEditing = editingProperty?.rowId === row.id && editingProperty?.columnId === column.id;
                        const propertyValue = getPropertyValue(row, column.id);
                        const columnType = column.property_type;
                        const isImmediate = isImmediateSaveType(columnType);
                        const width = getColumnWidth(column);

                        return (
                          <td key={column.id} style={{ width }}>
                            {isImmediate ? (
                              // Immediate save types: always show input
                              <PropertyInput
                                type={columnType}
                                value={propertyValue}
                                options={column.options}
                                onChange={(value) => handleImmediateSave(row.id, column.id, value)}
                                onSelectClick={(rect) => handleOpenSelectPopup(row.id, column.id, rect)}
                              />
                            ) : isEditing ? (
                              // Text-like types: show input only when editing
                              <PropertyInput
                                type={columnType}
                                value={editPropertyValue}
                                options={column.options}
                                onChange={setEditPropertyValue}
                                onBlur={handleSaveProperty}
                                autoFocus
                              />
                            ) : (
                              // Read mode for text-like types
                              <PropertyValue
                                type={columnType}
                                value={propertyValue}
                                options={column.options}
                                onClick={() => handleStartEditProperty(row.id, column.id)}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td></td>
                      <td className={styles.spacerColumn}></td>
                    </tr>
                  ))}
                  <tr>
                    <td className={styles.addRowCell} colSpan={columns.filter(c => c.name !== 'Title').length + 3}>
                      <button onClick={handleAddRow} className={styles.addRowBtn}>
                        + New page
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          )}

          {activeView.type === 'list' && (
            <ListView
              rows={processedRows}
              columns={columns}
              sectionId={sectionId || ''}
              onAddRow={handleAddRow}
              onUpdateRowName={handleUpdateRowName}
            />
          )}

          {activeView.type === 'gallery' && (
            <GalleryView
              rows={processedRows}
              columns={columns}
              sectionId={sectionId || ''}
              onAddRow={handleAddRow}
              onUpdateRowName={handleUpdateRowName}
            />
          )}

          {activeView.type === 'board' && (
            <BoardView
              rows={processedRows}
              columns={columns}
              sectionId={sectionId || ''}
              onAddRow={handleAddRow}
              onUpdateRowName={handleUpdateRowName}
              onUpdateProperty={handleUpdateProperty}
            />
          )}
        </>
      )}

      <AnimatePresence>
        {addColumnAnchor && (
          <AddColumnPopover
            anchorRect={addColumnAnchor}
            onSelect={handleCreateColumn}
            onClose={() => setAddColumnAnchor(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsColumn && (
          <ColumnSettingsPopup
            column={settingsColumn.column}
            anchorRect={settingsColumn.rect}
            onSave={(name) => handleSaveColumnName(settingsColumn.column.id, name)}
            onDelete={() => handleDeleteColumn(settingsColumn.column.id)}
            onClose={() => setSettingsColumn(null)}
          />
        )}
      </AnimatePresence>

      {sortPopupAnchor && (
        <SortPopup
          anchorRect={sortPopupAnchor}
          columns={sortableColumns}
          sorts={sorts}
          onUpdate={setSorts}
          onClose={() => setSortPopupAnchor(null)}
          onDeleteAll={handleDeleteAllSorts}
        />
      )}

      {editingFilter && (
        <FilterPopup
          anchorRect={editingFilter.rect}
          columns={sortableColumns}
          filter={editingFilter.filter}
          onSave={handleSaveFilter}
          onClose={() => setEditingFilter(null)}
        />
      )}

      {addViewPopupAnchor && (
        <AddViewPopup
          anchorRect={addViewPopupAnchor}
          onSelect={handleAddView}
          onClose={() => setAddViewPopupAnchor(null)}
        />
      )}

      {selectPopup && (() => {
        const column = columns.find(c => c.id === selectPopup.columnId);
        const row = rows.find(r => r.id === selectPopup.rowId);
        const currentValue = row?.properties.find(p => p.column_id === selectPopup.columnId)?.value || '';
        return (
          <SelectPopup
            anchorElement={selectPopup.anchorElement}
            value={currentValue}
            options={column?.options || []}
            onSelect={handleSelectValue}
            onCreateOption={(opt) => handleCreateSelectOption(selectPopup.columnId, opt)}
            onUpdateOption={(opt) => handleUpdateSelectOption(selectPopup.columnId, opt)}
            onDeleteOption={(optId) => handleDeleteSelectOption(selectPopup.columnId, optId)}
            onReorderOptions={(opts) => handleReorderSelectOptions(selectPopup.columnId, opts)}
            onClose={() => setSelectPopup(null)}
          />
        );
      })()}
    </div>
  );
}
