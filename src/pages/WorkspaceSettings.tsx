import { useState, useEffect, useRef } from 'react';
import { Header } from '../components/layout';
import { useWorkspace } from '../lib';
import { supabase } from '../lib/supabase';
import type { WorkspaceMemberWithUser, JoinRequestWithUser, Section } from '../types';
import styles from './WorkspaceSettings.module.css';

type Tab = 'members' | 'requests' | 'archive';

interface ConfirmAction {
  type: 'revoke' | 'revokeAll';
  memberId: string;
  memberName: string;
  sectionId?: string;
  sectionName?: string;
}

export function WorkspaceSettings() {
  const { currentWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [members, setMembers] = useState<WorkspaceMemberWithUser[]>([]);
  const [requests, setRequests] = useState<JoinRequestWithUser[]>([]);
  const [archivedSections, setArchivedSections] = useState<Section[]>([]);
  const [activeSections, setActiveSections] = useState<Section[]>([]);
  const [memberAccess, setMemberAccess] = useState<Record<string, Section[]>>({});
  const [accessDropdownOpen, setAccessDropdownOpen] = useState<string | null>(null);
  const [addAccessOpen, setAddAccessOpen] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isOwner = currentWorkspace?.role === 'owner';

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch members with user info
      const { data: membersData } = await supabase
        .from('workspace_members')
        .select(`
          *,
          user:users(*)
        `)
        .eq('workspace_id', currentWorkspace.id);

      if (membersData) {
        setMembers(membersData as unknown as WorkspaceMemberWithUser[]);
      }

      // Fetch pending requests (only for owners)
      if (isOwner) {
        const { data: requestsData } = await supabase
          .from('workspace_join_requests')
          .select(`
            *,
            user:users!workspace_join_requests_user_id_fkey_public(*)
          `)
          .eq('workspace_id', currentWorkspace.id)
          .eq('status', 'pending');

        if (requestsData) {
          setRequests(requestsData as unknown as JoinRequestWithUser[]);
        }

        // Fetch archived sections
        const { data: archivedData } = await supabase
          .from('sections')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .eq('is_archived', true)
          .order('name');

        if (archivedData) {
          setArchivedSections(archivedData);
        }

        // Fetch active sections
        const { data: activeData } = await supabase
          .from('sections')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .eq('is_archived', false)
          .order('name');

        if (activeData) {
          setActiveSections(activeData);
        }

        // Fetch section access for all members
        const { data: accessData } = await supabase
          .from('section_access')
          .select('*, section:sections(*)')
          .eq('workspace_id', currentWorkspace.id);

        if (accessData) {
          const accessMap: Record<string, Section[]> = {};
          for (const access of accessData) {
            if (!access.section || access.section.is_archived) continue;
            if (!accessMap[access.member_id]) {
              accessMap[access.member_id] = [];
            }
            accessMap[access.member_id].push(access.section);
          }
          setMemberAccess(accessMap);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [currentWorkspace, isOwner]);

  const handleApprove = async (requestId: string) => {
    const { error } = await supabase.rpc('approve_join_request', {
      p_request_id: requestId,
    });

    if (!error) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      // Refetch members
      const { data } = await supabase
        .from('workspace_members')
        .select(`*, user:users(*)`)
        .eq('workspace_id', currentWorkspace?.id);
      if (data) setMembers(data as unknown as WorkspaceMemberWithUser[]);
    }
  };

  const handleReject = async (requestId: string) => {
    const { error } = await supabase.rpc('reject_join_request', {
      p_request_id: requestId,
    });

    if (!error) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    }
  };

  const handleRecover = async (sectionId: string) => {
    const { error } = await supabase
      .from('sections')
      .update({ is_archived: false })
      .eq('id', sectionId);

    if (!error) {
      setArchivedSections((prev) => prev.filter((s) => s.id !== sectionId));
    }
  };

  const handleRevokeAccess = async (memberId: string, sectionId: string) => {
    const { error } = await supabase
      .from('section_access')
      .delete()
      .eq('member_id', memberId)
      .eq('section_id', sectionId);

    if (!error) {
      setMemberAccess((prev) => ({
        ...prev,
        [memberId]: (prev[memberId] || []).filter((s) => s.id !== sectionId),
      }));
    }
    setConfirmAction(null);
  };

  const handleRevokeAllAccess = async (memberId: string) => {
    const { error } = await supabase
      .from('section_access')
      .delete()
      .eq('member_id', memberId);

    if (!error) {
      setMemberAccess((prev) => ({
        ...prev,
        [memberId]: [],
      }));
    }
    setConfirmAction(null);
    setAccessDropdownOpen(null);
  };

  const handleGrantAccess = async (memberId: string, section: Section) => {
    const { error } = await supabase
      .from('section_access')
      .insert({
        member_id: memberId,
        section_id: section.id,
        workspace_id: currentWorkspace?.id,
      });

    if (!error) {
      setMemberAccess((prev) => ({
        ...prev,
        [memberId]: [...(prev[memberId] || []), section],
      }));
    }
    setAddAccessOpen(null);
  };

  const formatRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getMemberName = (member: WorkspaceMemberWithUser) => {
    return member.user?.name || member.user?.email || 'Unknown';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccessDropdownOpen(null);
      }
    };
    if (accessDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [accessDropdownOpen]);

  const joinCodeDisplay = currentWorkspace?.join_code ? (
    <div className={styles.joinCode}>
      <span className={styles.joinCodeLabel}>Join code</span>
      <code className={styles.joinCodeValue}>{currentWorkspace.join_code}</code>
    </div>
  ) : null;

  return (
    <div>
      <Header title="Workspace" rightContent={isOwner ? joinCodeDisplay : null} />

      <div className={styles.content}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'members' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Members
          </button>
          {isOwner && (
            <button
              className={`${styles.tab} ${activeTab === 'requests' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              Requests
              {requests.length > 0 && (
                <span className={styles.badge}>{requests.length}</span>
              )}
            </button>
          )}
          {isOwner && (
            <button
              className={`${styles.tab} ${activeTab === 'archive' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('archive')}
            >
              Archive
            </button>
          )}
        </div>

        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : activeTab === 'members' ? (
          <div className={styles.membersTable}>
            {members.length === 0 ? (
              <div className={styles.empty}>No members yet</div>
            ) : (
              <>
                <div className={styles.tableHeader}>
                  <span className={styles.colName}>Name</span>
                  <span className={styles.colRole}>Role</span>
                  {isOwner && <span className={styles.colAccess}>Access</span>}
                </div>
                {members.map((member) => {
                  const sections = memberAccess[member.id] || [];
                  const accessCount = sections.length;
                  const isDropdownOpen = accessDropdownOpen === member.id;

                  return (
                    <div key={member.id} className={styles.tableRow}>
                      <div className={styles.colName}>
                        <span className={styles.userName}>
                          {getMemberName(member)}
                        </span>
                        {member.user?.email && member.user?.name && (
                          <span className={styles.userEmail}>{member.user.email}</span>
                        )}
                      </div>
                      <div className={styles.colRole}>
                        <span className={styles.role}>{formatRole(member.role)}</span>
                      </div>
                      {isOwner && member.role !== 'owner' && (
                        <div
                          className={styles.colAccess}
                          ref={isDropdownOpen ? dropdownRef : null}
                        >
                          <button
                            className={styles.accessBtn}
                            onClick={() => setAccessDropdownOpen(isDropdownOpen ? null : member.id)}
                          >
                            {accessCount} {accessCount === 1 ? 'section' : 'sections'}
                          </button>
                          {isDropdownOpen && (
                            <div className={styles.accessDropdown}>
                              {sections.length === 0 ? (
                                <div className={styles.accessEmpty}>No access granted</div>
                              ) : (
                                <>
                                  {sections.map((section) => (
                                    <div key={section.id} className={styles.accessItem}>
                                      <span>{section.name}</span>
                                      <button
                                        className={styles.accessRemoveBtn}
                                        onClick={() => setConfirmAction({
                                          type: 'revoke',
                                          memberId: member.id,
                                          memberName: getMemberName(member),
                                          sectionId: section.id,
                                          sectionName: section.name,
                                        })}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </>
                              )}
                              {(() => {
                                const availableSections = activeSections.filter(
                                  (s) => !sections.some((ms) => ms.id === s.id)
                                );
                                if (availableSections.length === 0) return null;
                                return (
                                  <div className={styles.addAccessWrapper}>
                                    <button
                                      className={styles.addAccessBtn}
                                      onClick={() => setAddAccessOpen(addAccessOpen === member.id ? null : member.id)}
                                    >
                                      + Add access
                                    </button>
                                    {addAccessOpen === member.id && (
                                      <div className={styles.addAccessMenu}>
                                        {availableSections.map((section) => (
                                          <button
                                            key={section.id}
                                            className={styles.addAccessItem}
                                            onClick={() => handleGrantAccess(member.id, section)}
                                          >
                                            {section.name}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                              {sections.length > 0 && (
                                <button
                                  className={styles.revokeAllBtn}
                                  onClick={() => setConfirmAction({
                                    type: 'revokeAll',
                                    memberId: member.id,
                                    memberName: getMemberName(member),
                                  })}
                                >
                                  Revoke all access
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {isOwner && member.role === 'owner' && (
                        <div className={styles.colAccess}>
                          <span className={styles.accessFull}>Full access</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ) : activeTab === 'requests' ? (
          <div className={styles.list}>
            {requests.length === 0 ? (
              <div className={styles.empty}>No pending requests</div>
            ) : (
              requests.map((request) => (
                <div key={request.id} className={styles.listItem}>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>
                      {request.user?.name || request.user?.email || 'Unknown'}
                    </span>
                    {request.user?.email && request.user?.name && (
                      <span className={styles.userEmail}>{request.user.email}</span>
                    )}
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={styles.approveBtn}
                      onClick={() => handleApprove(request.id)}
                    >
                      Approve
                    </button>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => handleReject(request.id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'archive' ? (
          <div className={styles.list}>
            {archivedSections.length === 0 ? (
              <div className={styles.empty}>No archived sections</div>
            ) : (
              archivedSections.map((section) => (
                <div key={section.id} className={styles.listItem}>
                  <span className={styles.sectionName}>{section.name}</span>
                  <button
                    className={styles.recoverBtn}
                    onClick={() => handleRecover(section.id)}
                  >
                    Recover
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      {confirmAction && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmAction(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <p className={styles.confirmText}>
              {confirmAction.type === 'revoke'
                ? `Are you sure you want to remove access of ${confirmAction.memberName} to ${confirmAction.sectionName}?`
                : `Are you sure you want to revoke all access for ${confirmAction.memberName}?`}
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.confirmCancel}
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>
              <button
                className={styles.confirmConfirm}
                onClick={() => {
                  if (confirmAction.type === 'revoke' && confirmAction.sectionId) {
                    handleRevokeAccess(confirmAction.memberId, confirmAction.sectionId);
                  } else if (confirmAction.type === 'revokeAll') {
                    handleRevokeAllAccess(confirmAction.memberId);
                  }
                }}
              >
                {confirmAction.type === 'revoke' ? 'Remove access' : 'Revoke all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
