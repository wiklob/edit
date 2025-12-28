import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  FileText,
  File,
  Folder,
  FolderOpen,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Pin,
  Paperclip,
  Bookmark,
  Tag,
  Lightbulb,
  Star,
  Heart,
  Target,
  Rocket,
  Briefcase,
  Wrench,
  Settings,
  Sparkles,
  Flame,
  Gem,
  Palette,
  BookOpen,
  Music,
  Film,
  Camera,
  Globe,
  Home,
  User,
  type LucideIcon,
} from 'lucide-react';
import styles from './IconPicker.module.css';

const ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: 'file-text', Icon: FileText },
  { name: 'file', Icon: File },
  { name: 'folder', Icon: Folder },
  { name: 'folder-open', Icon: FolderOpen },
  { name: 'bar-chart', Icon: BarChart3 },
  { name: 'trending-up', Icon: TrendingUp },
  { name: 'trending-down', Icon: TrendingDown },
  { name: 'pin', Icon: Pin },
  { name: 'paperclip', Icon: Paperclip },
  { name: 'bookmark', Icon: Bookmark },
  { name: 'tag', Icon: Tag },
  { name: 'lightbulb', Icon: Lightbulb },
  { name: 'star', Icon: Star },
  { name: 'heart', Icon: Heart },
  { name: 'target', Icon: Target },
  { name: 'rocket', Icon: Rocket },
  { name: 'briefcase', Icon: Briefcase },
  { name: 'wrench', Icon: Wrench },
  { name: 'settings', Icon: Settings },
  { name: 'sparkles', Icon: Sparkles },
  { name: 'flame', Icon: Flame },
  { name: 'gem', Icon: Gem },
  { name: 'palette', Icon: Palette },
  { name: 'book-open', Icon: BookOpen },
  { name: 'music', Icon: Music },
  { name: 'film', Icon: Film },
  { name: 'camera', Icon: Camera },
  { name: 'globe', Icon: Globe },
  { name: 'home', Icon: Home },
  { name: 'user', Icon: User },
];

const EMOJIS = [
  '📄', '📝', '📋', '📁', '📂',
  '📊', '📈', '📉', '📌', '📎',
  '🔖', '🏷️', '💡', '⭐', '❤️',
  '🎯', '🚀', '💼', '🔧', '⚙️',
  '🌟', '✨', '🔥', '💎', '🎨',
  '📚', '🎵', '🎬', '📷', '🌍',
];

const COLORS = [
  { name: 'default', value: 'currentColor' },
  { name: 'gray', value: '#6b7280' },
  { name: 'red', value: '#ef4444' },
  { name: 'orange', value: '#f97316' },
  { name: 'amber', value: '#f59e0b' },
  { name: 'yellow', value: '#eab308' },
  { name: 'lime', value: '#84cc16' },
  { name: 'green', value: '#22c55e' },
  { name: 'teal', value: '#14b8a6' },
  { name: 'cyan', value: '#06b6d4' },
  { name: 'blue', value: '#3b82f6' },
  { name: 'purple', value: '#a855f7' },
  { name: 'pink', value: '#ec4899' },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICONS.map(({ name, Icon }) => [name, Icon])
);

const COLOR_MAP: Record<string, string> = Object.fromEntries(
  COLORS.map(({ name, value }) => [name, value])
);

interface IconPickerProps {
  icon: string | null;
  onSelect: (icon: string) => void;
  onRemove?: () => void;
  size?: 'small' | 'large';
}

export interface IconPickerHandle {
  open: () => void;
}

type Tab = 'icons' | 'emojis';

export const IconPicker = forwardRef<IconPickerHandle, IconPickerProps>(
  function IconPicker({ icon, onSelect, onRemove, size = 'small' }, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('icons');
  const [pendingIcon, setPendingIcon] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => setIsOpen(true),
  }));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setPendingIcon(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleIconClick = (iconName: string) => {
    setPendingIcon(iconName);
  };

  const handleColorSelect = (colorName: string) => {
    if (pendingIcon) {
      onSelect(`lucide:${pendingIcon}:${colorName}`);
      setIsOpen(false);
      setPendingIcon(null);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    onSelect(`emoji:${emoji}`);
    setIsOpen(false);
    setPendingIcon(null);
  };

  const handleRemove = () => {
    onRemove?.();
    setIsOpen(false);
    setPendingIcon(null);
  };

  const parseIcon = (iconStr: string | null) => {
    if (!iconStr) return { type: 'lucide', name: 'file-text', color: 'default' };

    if (iconStr.startsWith('emoji:')) {
      return { type: 'emoji', name: iconStr.replace('emoji:', ''), color: null };
    }

    const parts = iconStr.replace('lucide:', '').split(':');
    return {
      type: 'lucide',
      name: parts[0],
      color: parts[1] || 'default',
    };
  };

  const parsed = parseIcon(icon);

  const renderTriggerContent = () => {
    if (parsed.type === 'emoji') {
      return <span className={styles.triggerEmoji}>{parsed.name}</span>;
    }

    const IconComponent = ICON_MAP[parsed.name] || FileText;
    const color = COLOR_MAP[parsed.color || 'default'] || 'currentColor';
    return <IconComponent size={size === 'large' ? 48 : 24} color={color} />;
  };

  return (
    <div className={styles.wrapper} ref={pickerRef}>
      <button
        className={`${styles.trigger} ${styles[size]}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        {renderTriggerContent()}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {pendingIcon ? (
            <div className={styles.colorPicker}>
              <div className={styles.colorHeader}>
                Pick a color
              </div>
              <div className={styles.colorGrid}>
                {COLORS.map(({ name, value }) => (
                  <button
                    key={name}
                    className={styles.colorOption}
                    onClick={() => handleColorSelect(name)}
                    type="button"
                    title={name}
                  >
                    <span
                      className={styles.colorSwatch}
                      style={{ backgroundColor: value === 'currentColor' ? 'var(--color-text)' : value }}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className={styles.topBar}>
                <div className={styles.tabs}>
                  <button
                    className={`${styles.tab} ${tab === 'icons' ? styles.activeTab : ''}`}
                    onClick={() => setTab('icons')}
                    type="button"
                  >
                    Icons
                  </button>
                  <button
                    className={`${styles.tab} ${tab === 'emojis' ? styles.activeTab : ''}`}
                    onClick={() => setTab('emojis')}
                    type="button"
                  >
                    Emojis
                  </button>
                </div>
                {onRemove && (
                  <button
                    className={styles.removeBtn}
                    onClick={handleRemove}
                    type="button"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className={styles.grid}>
                {tab === 'icons' ? (
                  ICONS.map(({ name, Icon }) => (
                    <button
                      key={name}
                      className={`${styles.option} ${parsed.type === 'lucide' && parsed.name === name ? styles.selected : ''}`}
                      onClick={() => handleIconClick(name)}
                      type="button"
                    >
                      <Icon size={20} />
                    </button>
                  ))
                ) : (
                  EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      className={`${styles.option} ${icon === `emoji:${emoji}` ? styles.selected : ''}`}
                      onClick={() => handleEmojiSelect(emoji)}
                      type="button"
                    >
                      {emoji}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

// Helper to render an icon from a stored value
export function PageIcon({ icon, size = 20 }: { icon: string | null; size?: number }) {
  if (!icon) {
    return <FileText size={size} />;
  }

  if (icon.startsWith('emoji:')) {
    return <span style={{ fontSize: size * 0.8 }}>{icon.replace('emoji:', '')}</span>;
  }

  const parts = icon.replace('lucide:', '').split(':');
  const iconName = parts[0];
  const colorName = parts[1] || 'default';
  const IconComponent = ICON_MAP[iconName];
  const color = COLOR_MAP[colorName] || 'currentColor';

  if (IconComponent) {
    return <IconComponent size={size} color={color} />;
  }

  return <FileText size={size} />;
}
