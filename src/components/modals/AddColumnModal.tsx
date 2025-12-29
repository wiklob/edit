import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ColumnType, SelectOption } from '../../types';
import styles from './AddColumnModal.module.css';

const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi-select' },
];

const OPTION_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6b7280', // gray
  '#1f2937', // dark
];

interface AddColumnModalProps {
  onClose: () => void;
  onCreate: (name: string, type: ColumnType, options?: SelectOption[]) => void;
}

export function AddColumnModal({ onClose, onCreate }: AddColumnModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('text');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);

  const needsOptions = type === 'select' || type === 'multi_select';

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleAddOption = () => {
    const colorIndex = options.length % OPTION_COLORS.length;
    setOptions([
      ...options,
      {
        id: crypto.randomUUID(),
        label: '',
        color: OPTION_COLORS[colorIndex],
      },
    ]);
  };

  const handleRemoveOption = (id: string) => {
    setOptions(options.filter((o) => o.id !== id));
  };

  const handleOptionLabelChange = (id: string, label: string) => {
    setOptions(options.map((o) => (o.id === id ? { ...o, label } : o)));
  };

  const handleOptionColorChange = (id: string, color: string) => {
    setOptions(options.map((o) => (o.id === id ? { ...o, color } : o)));
    setColorPickerOpen(null);
  };

  const handleCreate = () => {
    if (!name.trim()) return;

    const validOptions = needsOptions
      ? options.filter((o) => o.label.trim())
      : undefined;

    onCreate(name.trim(), type, validOptions);
  };

  const canCreate = name.trim() && (!needsOptions || options.some((o) => o.label.trim()));

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <h2 className={styles.title}>Add column</h2>
            <button className={styles.closeButton} onClick={onClose}>
              ×
            </button>
          </div>

          <div className={styles.content}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Column name"
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Type</label>
              <select
                className={styles.select}
                value={type}
                onChange={(e) => {
                  setType(e.target.value as ColumnType);
                  setOptions([]);
                }}
              >
                {COLUMN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {needsOptions && (
              <div className={styles.optionsSection}>
                <div className={styles.optionsTitle}>Options</div>
                <div className={styles.optionsList}>
                  {options.map((option) => (
                    <div key={option.id} className={styles.optionRow}>
                      <div className={styles.colorPickerWrapper}>
                        <button
                          className={styles.optionColorBtn}
                          style={{ backgroundColor: option.color }}
                          onClick={() =>
                            setColorPickerOpen(
                              colorPickerOpen === option.id ? null : option.id
                            )
                          }
                        />
                        {colorPickerOpen === option.id && (
                          <div className={styles.colorPicker}>
                            {OPTION_COLORS.map((color) => (
                              <button
                                key={color}
                                className={`${styles.colorOption} ${
                                  option.color === color
                                    ? styles.colorOptionSelected
                                    : ''
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() =>
                                  handleOptionColorChange(option.id, color)
                                }
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        className={styles.optionInput}
                        value={option.label}
                        onChange={(e) =>
                          handleOptionLabelChange(option.id, e.target.value)
                        }
                        placeholder="Option label"
                      />
                      <button
                        className={styles.optionRemoveBtn}
                        onClick={() => handleRemoveOption(option.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button className={styles.addOptionBtn} onClick={handleAddOption}>
                  + Add option
                </button>
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <button className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              className={styles.createBtn}
              onClick={handleCreate}
              disabled={!canCreate}
            >
              Create
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
