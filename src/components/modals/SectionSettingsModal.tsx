import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import type { Section, SectionAccessWithMember, WorkspaceMemberWithUser } from '../../types';
import styles from './SectionSettingsModal.module.css';

type Tab = 'general' | 'members' | 'security';

interface SectionSettingsModalProps {
  section: Section;
  initialTab?: Tab;
  onClose: () => void;
}

interface MemberDisplay {
  id: string;
  name: string;
  role: string;
}

export function SectionSettingsModal({ section, initialTab = 'general', onClose }: SectionSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [members, setMembers] = useState<MemberDisplay[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    if (activeTab !== 'members') return;

    const fetchMembers = async () => {
      setLoading(true);
      const membersList: MemberDisplay[] = [];

      // Fetch workspace owners (they have full access)
      const { data: ownerData } = await supabase
        .from('workspace_members')
        .select('*, user:users(*)')
        .eq('workspace_id', section.workspace_id)
        .eq('role', 'owner');

      if (ownerData) {
        for (const member of ownerData as unknown as WorkspaceMemberWithUser[]) {
          membersList.push({
            id: member.id,
            name: member.user?.name || member.user?.email || 'Unknown',
            role: 'Owner',
          });
        }
      }

      // Fetch members with explicit access to this section
      const { data: accessData } = await supabase
        .from('section_access')
        .select('*, member:workspace_members(*, user:users(*))')
        .eq('section_id', section.id);

      if (accessData) {
        for (const access of accessData as unknown as SectionAccessWithMember[]) {
          if (!access.member) continue;
          membersList.push({
            id: access.member.id,
            name: access.member.user?.name || access.member.user?.email || 'Unknown',
            role: access.member.role.charAt(0).toUpperCase() + access.member.role.slice(1),
          });
        }
      }

      setMembers(membersList);
      setLoading(false);
    };

    fetchMembers();
  }, [activeTab, section.id, section.workspace_id]);

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <h2 className={styles.title}>{section.name}</h2>
            <button className={styles.closeButton} onClick={onClose}>×</button>
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'general' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('general')}
            >
              General
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'members' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('members')}
            >
              Members
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'security' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('security')}
            >
              Security
            </button>
          </div>

          <div className={styles.content}>
            {activeTab === 'general' && (
              <div className={styles.placeholder}>General settings coming soon</div>
            )}
            {activeTab === 'members' && (
              <div className={styles.membersList}>
                {loading ? (
                  <div className={styles.placeholder}>Loading...</div>
                ) : members.length === 0 ? (
                  <div className={styles.placeholder}>No members have access</div>
                ) : (
                  members.map((member) => (
                    <div key={member.id} className={styles.memberRow}>
                      <span className={styles.memberName}>{member.name}</span>
                      <span className={styles.memberRole}>{member.role}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === 'security' && (
              <div className={styles.placeholder}>Security settings coming soon</div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
