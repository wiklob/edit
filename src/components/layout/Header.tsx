import type { ReactNode } from 'react';
import { Breadcrumb, type BreadcrumbItem } from '../common';
import styles from './Header.module.css';

interface HeaderProps {
  title?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  rightContent?: ReactNode;
}

export function Header({ title, breadcrumbs, rightContent }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {breadcrumbs ? (
          <Breadcrumb items={breadcrumbs} />
        ) : (
          <h1 className={styles.title}>{title}</h1>
        )}
      </div>
      {rightContent && <div className={styles.rightContent}>{rightContent}</div>}
    </header>
  );
}
