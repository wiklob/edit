import type { ReactNode } from 'react';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
  rightContent?: ReactNode;
}

export function Header({ title, rightContent }: HeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {rightContent && <div className={styles.rightContent}>{rightContent}</div>}
    </header>
  );
}
