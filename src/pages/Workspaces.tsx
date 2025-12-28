import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../lib';
import { supabase } from '../lib/supabase';
import styles from './Workspaces.module.css';

export function Workspaces() {
  const navigate = useNavigate();
  const { workspaces, createWorkspace, setCurrentWorkspace } = useWorkspace();
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

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

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const code = joinCode.replace(/\D/g, '');
    if (code.length !== 7) {
      setError('Please enter a valid 7-digit join code');
      return;
    }

    setJoining(true);
    const { error: joinError } = await supabase.rpc('request_to_join', {
      p_join_code: code,
    });
    setJoining(false);

    if (joinError) {
      if (joinError.message.includes('already a member')) {
        setError('You are already a member of this workspace');
      } else if (joinError.message.includes('already requested')) {
        setError('You have already requested to join this workspace');
      } else if (joinError.message.includes('Invalid join code')) {
        setError('Invalid join code');
      } else {
        setError(joinError.message || 'Failed to submit join request');
      }
    } else {
      setSuccess('Request submitted! The workspace owner will review your request.');
      setJoinCode('');
    }
  };

  const formatJoinCode = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 7);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <img src="/e5.png" alt="" className={styles.logo} />
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
              <button onClick={() => setMode('join')} className={styles.buttonSecondary}>
                Join workspace
              </button>
            </div>
          </>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Join code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(formatJoinCode(e.target.value))}
                placeholder="1234567"
                className={styles.input}
                autoFocus
              />
              <span className={styles.hint}>Enter the 7-digit code from the workspace owner</span>
            </div>

            {error && <p className={styles.error}>{error}</p>}
            {success && <p className={styles.success}>{success}</p>}

            <div className={styles.actions}>
              <button type="submit" className={styles.button} disabled={joining}>
                {joining ? 'Submitting...' : 'Request to join'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('select');
                  setError('');
                  setSuccess('');
                  setJoinCode('');
                }}
                className={styles.buttonSecondary}
              >
                Back
              </button>
            </div>
          </form>
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
