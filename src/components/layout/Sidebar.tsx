import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, useWorkspace } from '../../lib';
import { supabase } from '../../lib/supabase';
import { SectionSettingsModal } from '../modals';
import type { Section } from '../../types';
import styles from './Sidebar.module.css';

type ModalTab = 'general' | 'members' | 'security';

export function Sidebar() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [modalSection, setModalSection] = useState<Section | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>('general');
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwner = currentWorkspace?.role === 'owner';
  const visibleSections = sections.filter(s => !s.is_archived);

  useEffect(() => {
    if (!currentWorkspace) {
      setSections([]);
      return;
    }

    const fetchSections = async () => {
      const { data } = await supabase
        .from('sections')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('display_order');

      if (data) {
        setSections(data);
      }
    };

    fetchSections();
  }, [currentWorkspace]);

  const handleSwitch = (workspace: typeof workspaces[0]) => {
    setCurrentWorkspace(workspace);
    setSwitcherOpen(false);
  };

  const handleCreateSection = async () => {
    if (!newSectionName.trim() || !currentWorkspace) return;

    const maxOrder = sections.length > 0
      ? Math.max(...sections.map(s => s.display_order))
      : 0;

    const { data, error } = await supabase
      .from('sections')
      .insert({
        workspace_id: currentWorkspace.id,
        name: newSectionName.trim(),
        display_order: maxOrder + 1,
      })
      .select()
      .single();

    if (data && !error) {
      setSections([...sections, data]);
      setNewSectionName('');
      setIsCreating(false);
      navigate(`/section/${data.id}`);
    }
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateSection();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setNewSectionName('');
    }
  };

  const handleArchiveSection = async (section: Section) => {
    const { error } = await supabase
      .from('sections')
      .update({ is_archived: true })
      .eq('id', section.id);

    if (!error) {
      setSections(sections.map(s =>
        s.id === section.id ? { ...s, is_archived: true } : s
      ));
      setMenuOpenId(null);
      // Navigate away if we're on the archived section
      navigate('/');
    }
  };

  const handleCreateDatabase = async (section: Section) => {
    const { data, error } = await supabase
      .from('pages')
      .insert({
        section_id: section.id,
        type: 'database',
        database_type: 'articles',
        name: 'Untitled Database',
      })
      .select()
      .single();

    if (data && !error) {
      setMenuOpenId(null);
      navigate(`/section/${section.id}/page/${data.id}`);
    }
  };

  const handleCreateTextPage = async (section: Section) => {
    const { data, error } = await supabase
      .from('pages')
      .insert({
        section_id: section.id,
        type: 'text',
        name: 'Untitled Page',
      })
      .select()
      .single();

    if (data && !error) {
      setMenuOpenId(null);
      navigate(`/section/${section.id}/page/${data.id}`);
    }
  };

  const openSectionSettings = (section: Section, tab: ModalTab = 'general') => {
    setModalSection(section);
    setModalTab(tab);
    setMenuOpenId(null);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    if (menuOpenId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId]);

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
        {visibleSections.map((section) => (
          <div key={section.id} className={styles.sectionItem}>
            <NavLink
              to={`/section/${section.id}`}
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
                  {section.name}
                </>
              )}
            </NavLink>
            {isOwner && (
              <div className={styles.sectionMenuWrapper} ref={menuOpenId === section.id ? menuRef : null}>
                <button
                  className={styles.sectionMenuBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === section.id ? null : section.id);
                  }}
                >
                  ⋯
                </button>
                <AnimatePresence>
                  {menuOpenId === section.id && (
                    <motion.div
                      className={styles.sectionMenu}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                    >
                      <button
                        className={styles.sectionMenuItem}
                        onClick={() => handleCreateDatabase(section)}
                      >
                        New database
                      </button>
                      <button
                        className={styles.sectionMenuItem}
                        onClick={() => handleCreateTextPage(section)}
                      >
                        New text page
                      </button>
                      <div className={styles.menuDivider} />
                      <button
                        className={styles.sectionMenuItem}
                        onClick={() => openSectionSettings(section, 'members')}
                      >
                        Add members
                      </button>
                      <button
                        className={styles.sectionMenuItem}
                        onClick={() => openSectionSettings(section, 'general')}
                      >
                        Section settings
                      </button>
                      <button
                        className={styles.sectionMenuItem}
                        onClick={() => handleArchiveSection(section)}
                      >
                        Archive section
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        ))}

        {isOwner && (
          isCreating ? (
            <input
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={handleCreateKeyDown}
              onBlur={() => {
                if (!newSectionName.trim()) {
                  setIsCreating(false);
                }
              }}
              placeholder="Section name"
              className={styles.createInput}
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className={styles.createButton}
            >
              + New section
            </button>
          )
        )}

        <div className={styles.divider} />

        <NavLink
          to="/workspace-settings"
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
              Workspace
            </>
          )}
        </NavLink>
      </nav>

      <div className={styles.footer}>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `${styles.footerLink} ${isActive ? styles.footerLinkActive : ''}`
          }
        >
          My settings
        </NavLink>
        <div className={styles.userInfo}>
          <span className={styles.email}>{user?.email}</span>
          <button onClick={signOut} className={styles.signOut}>Sign out</button>
        </div>
      </div>

      {modalSection && (
        <SectionSettingsModal
          section={modalSection}
          initialTab={modalTab}
          onClose={() => setModalSection(null)}
        />
      )}
    </aside>
  );
}
