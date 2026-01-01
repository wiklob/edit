import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SelectOption } from '../../types';
import styles from './Properties.module.css';

// Predefined colors with names (matching Notion style)
export const OPTION_COLORS: { color: string; name: string }[] = [
  { color: '#e5e5e5', name: 'Default' },
  { color: '#9ca3af', name: 'Gray' },
  { color: '#a8a29e', name: 'Brown' },
  { color: '#fdba74', name: 'Orange' },
  { color: '#fde047', name: 'Yellow' },
  { color: '#86efac', name: 'Green' },
  { color: '#93c5fd', name: 'Blue' },
  { color: '#c4b5fd', name: 'Purple' },
  { color: '#f9a8d4', name: 'Pink' },
  { color: '#fca5a5', name: 'Red' },
];

function getRandomColor(): string {
  return OPTION_COLORS[Math.floor(Math.random() * OPTION_COLORS.length)].color;
}

function isLightColor(hex: string): boolean {
  const color = hex.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

interface SelectPopupProps {
  anchorElement: HTMLElement;
  value: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
  onCreateOption: (option: SelectOption) => Promise<void> | void;
  onUpdateOption?: (option: SelectOption) => Promise<void> | void;
  onDeleteOption?: (optionId: string) => Promise<void> | void;
  onReorderOptions?: (options: SelectOption[]) => Promise<void> | void;
  onClose: () => void;
}

function calculatePosition(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  // Offset: 1px border + 8px padding + 1px adjustment
  return {
    top: rect.top - 9,
    left: rect.left - 9,
    width: rect.width + 18,
  };
}

export function SelectPopup({
  anchorElement,
  value,
  options,
  onSelect,
  onCreateOption,
  onUpdateOption,
  onDeleteOption,
  onReorderOptions,
  onClose,
}: SelectPopupProps) {
  const [search, setSearch] = useState('');
  const [localOptions, setLocalOptions] = useState<SelectOption[]>(options);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState<{ optionId: string; position: { top: number; left: number } } | null>(null);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [position, setPosition] = useState(() => calculatePosition(anchorElement));
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Sync local options with props
  useEffect(() => {
    setLocalOptions(options);
  }, [options]);

  // Update position on resize only (not scroll - causes jitter during pinch-zoom)
  useEffect(() => {
    const updatePosition = () => {
      setPosition(calculatePosition(anchorElement));
    };

    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorElement]);

  // Get selected option
  const selectedOption = value ? localOptions.find(opt => opt.id === value) : null;

  // Filter options based on search (exclude currently selected)
  const filteredOptions = localOptions.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  // Check if search matches exactly an existing option
  const exactMatch = localOptions.some(
    opt => opt.label.toLowerCase() === search.toLowerCase()
  );

  // Show create option if search is not empty and no exact match
  const showCreateOption = search.trim() !== '' && !exactMatch;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (editingOption && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingOption]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (menuOpen !== null || editingOption) {
          setMenuOpen(null);
          setEditingOption(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, menuOpen, editingOption]);

  const handleSelect = (optionId: string) => {
    if (editingOption || menuOpen !== null) return;
    onSelect(optionId);
    onClose();
  };

  const handleRemoveSelected = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect('');
  };

  const handleCreate = async () => {
    const newOption: SelectOption = {
      id: crypto.randomUUID(),
      label: search.trim(),
      color: getRandomColor(),
    };
    await onCreateOption(newOption);
    onSelect(newOption.id);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showCreateOption) {
        handleCreate();
      } else if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0].id);
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOptions = [...localOptions];
    const [draggedItem] = newOptions.splice(draggedIndex, 1);
    newOptions.splice(dropIndex, 0, draggedItem);

    setLocalOptions(newOptions);
    setDraggedIndex(null);
    setDragOverIndex(null);

    if (onReorderOptions) {
      await onReorderOptions(newOptions);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Option menu handlers
  const handleMenuClick = (e: React.MouseEvent, optionId: string) => {
    e.stopPropagation();
    if (menuOpen?.optionId === optionId) {
      setMenuOpen(null);
    } else {
      const button = e.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();
      setMenuOpen({
        optionId,
        position: { top: rect.bottom + 4, left: rect.left }
      });
    }
    setEditingOption(null);
  };

  const handleColorSelect = async (optionId: string, color: string) => {
    const option = localOptions.find(o => o.id === optionId);
    if (option && onUpdateOption) {
      const updated = { ...option, color };
      setLocalOptions(prev => prev.map(o => o.id === optionId ? updated : o));
      await onUpdateOption(updated);
    }
    setMenuOpen(null);
  };

  const handleRenameSubmit = async (optionId: string) => {
    if (!editingName.trim()) {
      setEditingOption(null);
      return;
    }
    const option = localOptions.find(o => o.id === optionId);
    if (option && onUpdateOption) {
      const updated = { ...option, label: editingName.trim() };
      setLocalOptions(prev => prev.map(o => o.id === optionId ? updated : o));
      await onUpdateOption(updated);
    }
    setEditingOption(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, optionId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit(optionId);
    } else if (e.key === 'Escape') {
      setEditingOption(null);
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent, optionId: string) => {
    e.stopPropagation();
    if (onDeleteOption) {
      setLocalOptions(prev => prev.filter(o => o.id !== optionId));
      await onDeleteOption(optionId);
      // If deleted option was selected, clear selection
      if (value === optionId) {
        onSelect('');
      }
    }
    setMenuOpen(null);
  };

  // Position popup to align content with cell content
  const style: React.CSSProperties = {
    position: 'fixed',
    top: position.top,
    left: position.left,
    minWidth: Math.max(position.width, 200),
  };

  return (
    <div ref={popupRef} className={styles.selectPopup} style={style}>
      <div className={styles.selectPopupSearch}>
        <div className={styles.selectPopupInputWrapper}>
          {selectedOption && (
            <span
              className={`${styles.optionTag} ${styles.optionTagInInput} ${selectedOption.color && isLightColor(selectedOption.color) ? styles.optionTagLight : ''}`}
              style={{ backgroundColor: selectedOption.color || '#6b7280' }}
            >
              {selectedOption.label}
              <button
                className={styles.tagRemoveBtn}
                onClick={handleRemoveSelected}
                type="button"
              >
                ×
              </button>
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            className={styles.selectPopupInputInline}
            placeholder={selectedOption ? '' : 'Search or create...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
      <div className={styles.selectPopupOptions}>
        {filteredOptions.map((option, index) => (
          <div
            key={option.id}
            className={`${styles.selectPopupOption} ${option.id === value ? styles.selectPopupOptionSelected : ''} ${dragOverIndex === index ? styles.selectPopupOptionDragOver : ''} ${draggedIndex === index ? styles.selectPopupOptionDragging : ''}`}
            onClick={() => handleSelect(option.id)}
            draggable={!editingOption}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            <span className={styles.dragHandle}>☰</span>
            {editingOption === option.id ? (
              <input
                ref={editInputRef}
                type="text"
                className={styles.optionRenameInput}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => handleRenameKeyDown(e, option.id)}
                onBlur={() => handleRenameSubmit(option.id)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className={`${styles.optionTag} ${option.color && isLightColor(option.color) ? styles.optionTagLight : ''}`}
                style={{ backgroundColor: option.color || '#6b7280' }}
              >
                {option.label}
              </span>
            )}
            <button
              className={styles.optionMenuBtn}
              onClick={(e) => handleMenuClick(e, option.id)}
              type="button"
            >
              ⋯
            </button>
          </div>
        ))}
        {filteredOptions.length === 0 && !showCreateOption && (
          <div className={styles.selectPopupEmpty}>No options</div>
        )}
        {showCreateOption && (
          <>
            {filteredOptions.length > 0 && <div className={styles.selectPopupDivider} />}
            <div
              className={styles.selectPopupOption}
              onClick={handleCreate}
            >
              <span className={styles.selectPopupCreate}>
                Create "<strong>{search.trim()}</strong>"
              </span>
            </div>
          </>
        )}
      </div>
      {menuOpen !== null && (() => {
        const option = localOptions.find(o => o.id === menuOpen.optionId);
        if (!option) return null;
        return createPortal(
          <div
            className={styles.optionMenu}
            style={{
              position: 'fixed',
              top: menuOpen.position.top,
              left: menuOpen.position.left,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={styles.optionMenuRenameRow}>
              <input
                type="text"
                className={styles.optionMenuRenameInput}
                value={editingOption === option.id ? editingName : option.label}
                onChange={(e) => {
                  setEditingOption(option.id);
                  setEditingName(e.target.value);
                }}
                onBlur={() => {
                  if (editingOption === option.id) {
                    handleRenameSubmit(option.id);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameSubmit(option.id);
                  }
                }}
              />
            </div>
            <div
              className={styles.optionMenuItem}
              onClick={(e) => handleDeleteClick(e, option.id)}
            >
              Delete option
            </div>
            <div className={styles.optionMenuDivider} />
            <div className={styles.optionMenuLabel}>Colors</div>
            {OPTION_COLORS.map((colorItem) => (
              <div
                key={colorItem.color}
                className={`${styles.optionMenuItem} ${styles.optionColorItem}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleColorSelect(option.id, colorItem.color);
                }}
              >
                <span
                  className={styles.colorSwatch}
                  style={{ backgroundColor: colorItem.color }}
                />
                {colorItem.name}
                {option.color === colorItem.color && (
                  <span className={styles.colorCheck}>✓</span>
                )}
              </div>
            ))}
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
