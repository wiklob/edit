import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, useWorkspace } from '../../lib';
import styles from './Sidebar.module.css';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/' },
  { id: 'articles', label: 'Articles', path: '/articles' },
  { id: 'pipeline', label: 'Pipeline', path: '/pipeline' },
  { id: 'calendar', label: 'Calendar', path: '/calendar' },
  { id: 'settings', label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const handleSwitch = (workspace: typeof workspaces[0]) => {
    setCurrentWorkspace(workspace);
    setSwitcherOpen(false);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <img src="/e.png" alt="" className={styles.logoImg} />
        <span>edit</span>
      </div>

      {currentWorkspace && (
        <div className={styles.workspaceSwitcher}>
          <button
            onClick={() => setSwitcherOpen(!switcherOpen)}
            className={styles.currentWorkspace}
          >
            <span className={styles.workspaceName}>{currentWorkspace.name}</span>
            <span className={styles.chevron}>{switcherOpen ? '−' : '+'}</span>
          </button>

          <AnimatePresence>
            {switcherOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={styles.dropdown}
              >
                {workspaces
                  .filter((w) => w.id !== currentWorkspace.id)
                  .map((w) => (
                    <button
                      key={w.id}
                      onClick={() => handleSwitch(w)}
                      className={styles.dropdownItem}
                    >
                      {w.name}
                    </button>
                  ))}
                <button
                  onClick={() => {
                    setSwitcherOpen(false);
                    navigate('/workspaces');
                  }}
                  className={styles.dropdownItem}
                >
                  Manage workspaces
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className={styles.activeIndicator}
                    transition={{ type: 'spring', duration: 0.25, bounce: 0.15 }}
                  />
                )}
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <span className={styles.email}>{user?.email}</span>
        <button onClick={signOut} className={styles.signOut}>Sign out</button>
      </div>
    </aside>
  );
}
