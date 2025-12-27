import styles from './Placeholder.module.css';

interface PlaceholderProps {
  message?: string;
}

export function Placeholder({ message = 'Coming soon' }: PlaceholderProps) {
  return (
    <div className={styles.placeholder}>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
