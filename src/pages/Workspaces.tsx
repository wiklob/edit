import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../lib';
import styles from './Workspaces.module.css';

export function Workspaces() {
  const navigate = useNavigate();
  const { workspaces, createWorkspace, setCurrentWorkspace } = useWorkspace();
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSelectWorkspace = (workspace: typeof workspaces[0]) => {
    setCurrentWorkspace(workspace);
    navigate('/');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !slug.trim()) {
      setError('Name and slug are required');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    setCreating(true);
    const workspace = await createWorkspace(name.trim(), slug.trim());
    setCreating(false);

    if (workspace) {
      navigate('/');
    } else {
      setError('Failed to create workspace. Slug might already be taken.');
    }
  };

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 48);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <img src="/e.png" alt="" className={styles.logo} />
        <h1 className={styles.title}>Workspaces</h1>

        {mode === 'select' && (
          <>
            {workspaces.length > 0 && (
              <div className={styles.list}>
                {workspaces.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => handleSelectWorkspace(w)}
                    className={styles.workspaceItem}
                  >
                    <span className={styles.workspaceName}>{w.name}</span>
                    <span className={styles.workspaceSlug}>{w.slug}</span>
                  </button>
                ))}
              </div>
            )}

            <div className={styles.actions}>
              <button onClick={() => setMode('create')} className={styles.button}>
                Create workspace
              </button>
              <button className={styles.buttonSecondary} disabled>
                Join workspace
              </button>
            </div>
          </>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Editorial"
                className={styles.input}
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(generateSlug(e.target.value))}
                placeholder="acme-editorial"
                className={styles.input}
              />
              <span className={styles.hint}>edit.app/{slug || 'your-slug'}</span>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button type="submit" className={styles.button} disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setMode('select')}
                className={styles.buttonSecondary}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
