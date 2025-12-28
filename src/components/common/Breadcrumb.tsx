import { Link } from 'react-router-dom';
import { PageIcon } from './IconPicker';
import styles from './Breadcrumb.module.css';

export interface BreadcrumbItem {
  label: string;
  icon?: string | null;
  to?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className={styles.breadcrumb}>
      {items.map((item, index) => (
        <span key={index} className={styles.item}>
          {index > 0 && <span className={styles.separator}>/</span>}
          {item.to ? (
            <Link to={item.to} className={styles.link}>
              {item.icon && <span className={styles.icon}><PageIcon icon={item.icon} size={14} /></span>}
              {item.label}
            </Link>
          ) : (
            <span className={styles.current}>
              {item.icon && <span className={styles.icon}><PageIcon icon={item.icon} size={14} /></span>}
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
