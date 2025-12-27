import { useAuth } from '../lib';
import styles from './Login.module.css';

export function Login() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <img src="/e.png" alt="" className={styles.logo} />
        <h1 className={styles.title}>edit</h1>
        <p className={styles.subtitle}>Sign in to continue</p>
        <button onClick={signInWithGoogle} className={styles.button}>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
