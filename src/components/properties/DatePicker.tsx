import { useState, useRef, useEffect } from 'react';
import styles from './Properties.module.css';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  // Returns 0-6 where 0 is Monday
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function DatePicker({ value, onChange, onBlur, autoFocus }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(autoFocus ?? false);
  const [inputValue, setInputValue] = useState(formatDisplayDate(value));
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse value to get current view month/year
  const selectedDate = value ? new Date(value + 'T00:00:00') : null;
  const today = new Date();

  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());

  useEffect(() => {
    setInputValue(formatDisplayDate(value));
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setPopupPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    // Try to parse the input value
    const parsed = new Date(inputValue);
    if (!isNaN(parsed.getTime())) {
      const isoDate = parsed.toISOString().split('T')[0];
      onChange(isoDate);
      setInputValue(formatDisplayDate(isoDate));
    } else if (inputValue === '') {
      onChange('');
    } else {
      setInputValue(formatDisplayDate(value));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
      setIsOpen(false);
      onBlur?.();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      onBlur?.();
    }
  };

  const handleDateSelect = (day: number, monthOffset: number = 0) => {
    let year = viewYear;
    let month = viewMonth + monthOffset;

    if (month < 0) {
      month = 11;
      year--;
    } else if (month > 11) {
      month = 0;
      year++;
    }

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
    setIsOpen(false);
    onBlur?.();
  };

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Generate calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const daysInPrevMonth = getDaysInMonth(viewYear, viewMonth - 1);

  const calendarDays: { day: number; monthOffset: number; isCurrentMonth: boolean }[] = [];

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({ day: daysInPrevMonth - i, monthOffset: -1, isCurrentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, monthOffset: 0, isCurrentMonth: true });
  }

  // Next month days
  const remainingDays = 42 - calendarDays.length; // 6 rows * 7 days
  for (let i = 1; i <= remainingDays; i++) {
    calendarDays.push({ day: i, monthOffset: 1, isCurrentMonth: false });
  }

  const isSelectedDate = (day: number, monthOffset: number) => {
    if (!selectedDate) return false;
    let checkYear = viewYear;
    let checkMonth = viewMonth + monthOffset;
    if (checkMonth < 0) { checkMonth = 11; checkYear--; }
    if (checkMonth > 11) { checkMonth = 0; checkYear++; }
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === checkMonth &&
      selectedDate.getFullYear() === checkYear
    );
  };

  const isToday = (day: number, monthOffset: number) => {
    let checkYear = viewYear;
    let checkMonth = viewMonth + monthOffset;
    if (checkMonth < 0) { checkMonth = 11; checkYear--; }
    if (checkMonth > 11) { checkMonth = 0; checkYear++; }
    return (
      today.getDate() === day &&
      today.getMonth() === checkMonth &&
      today.getFullYear() === checkYear
    );
  };

  const handleClose = () => {
    setIsOpen(false);
    onBlur?.();
  };

  return (
    <div className={styles.datePicker}>
      <input
        ref={inputRef}
        type="text"
        className={styles.datePickerInput}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        placeholder=""
      />
      {isOpen && (
        <>
          <div className={styles.datePickerOverlay} onClick={handleClose} />
          <div className={styles.datePickerPopup} style={{ top: popupPosition.top, left: popupPosition.left }}>
          <div className={styles.datePickerHeader}>
            <span className={styles.datePickerTitle}>
              {MONTHS[viewMonth].slice(0, 3)} {viewYear}
            </span>
            <div className={styles.datePickerNav}>
              <button type="button" onClick={goToPrevMonth} className={styles.datePickerNavBtn}>
                ‹
              </button>
              <button type="button" onClick={goToNextMonth} className={styles.datePickerNavBtn}>
                ›
              </button>
            </div>
          </div>
          <div className={styles.datePickerDays}>
            {DAYS.map(day => (
              <div key={day} className={styles.datePickerDayHeader}>{day}</div>
            ))}
          </div>
          <div className={styles.datePickerGrid}>
            {calendarDays.map((item, index) => (
              <button
                key={index}
                type="button"
                className={`${styles.datePickerDay} ${!item.isCurrentMonth ? styles.datePickerDayOther : ''} ${isSelectedDate(item.day, item.monthOffset) ? styles.datePickerDaySelected : ''} ${isToday(item.day, item.monthOffset) && !isSelectedDate(item.day, item.monthOffset) ? styles.datePickerDayToday : ''}`}
                onClick={() => handleDateSelect(item.day, item.monthOffset)}
              >
                {item.day}
              </button>
            ))}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
