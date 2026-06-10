import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useFriendsStore } from '../stores/friendsStore.js';
import { useAuthStore } from '../stores/authStore.js';

interface Props {
  roomCode?: string;
  onChallenge?: (username: string) => Promise<{ error: string | null }>;
  onClose: () => void;
}

export default function FriendsPanel({ roomCode, onChallenge, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const {
    friends, pendingIn, invites,
    fetchFriends, fetchRequests,
    acceptRequest, removeOrCancel,
    searchResults, searchUsers, clearSearch,
    sendRequest, sendGameInvite, dismissInvite,
  } = useFriendsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [requestStatus, setRequestStatus] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});
  const [inviteStatus, setInviteStatus] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});
  const [challengeStatus, setChallengeStatus] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchFriends();
    fetchRequests();
  }, [user]);

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { clearSearch(); return; }
    searchTimeout.current = setTimeout(() => searchUsers(q), 300);
  }

  async function handleSendRequest(username: string) {
    setRequestStatus((s) => ({ ...s, [username]: 'sending' }));
    const { error } = await sendRequest(username);
    setRequestStatus((s) => ({ ...s, [username]: error ? 'error' : 'sent' }));
  }

  async function handleInvite(username: string) {
    if (!roomCode) return;
    setInviteStatus((s) => ({ ...s, [username]: 'sending' }));
    const { error } = await sendGameInvite(username, roomCode);
    setInviteStatus((s) => ({ ...s, [username]: error ? 'error' : 'sent' }));
  }

  async function handleChallenge(username: string) {
    if (!onChallenge) return;
    setChallengeStatus((s) => ({ ...s, [username]: 'sending' }));
    const { error } = await onChallenge(username);
    setChallengeStatus((s) => ({ ...s, [username]: error ? 'error' : 'sent' }));
  }

  if (!user) {
    return (
      <PanelShell onClose={onClose}>
        <div style={{ padding: '2rem 1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <p style={{ margin: '0 0 1rem' }}>Sign in to use Friends.</p>
          <Link
            to="/login"
            style={{
              display: 'inline-block',
              padding: '0.6rem 1.25rem',
              borderRadius: '0.5rem',
              background: 'var(--p1-primary)',
              color: '#fff', fontWeight: 700,
              textDecoration: 'none', fontSize: '0.85rem',
              fontFamily: 'var(--font-display)',
            }}
          >
            Sign In
          </Link>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell onClose={onClose}>
      {/* Pending game invites banner */}
      <AnimatePresence>
        {invites.map((inv) => (
          <motion.div
            key={inv.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              margin: '0.75rem 0.875rem 0',
              padding: '0.75rem 1rem',
              background: 'rgba(37,99,235,0.12)',
              border: '1px solid rgba(37,99,235,0.35)',
              borderRadius: '0.75rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem' }}>
                {inv.fromUsername ?? 'Someone'} invited you!
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Room {inv.roomCode}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <Link
                to={`/room/${inv.roomCode}`}
                style={{
                  padding: '0.4rem 0.875rem',
                  borderRadius: '0.375rem',
                  background: 'var(--p1-primary)',
                  color: '#fff', fontWeight: 700,
                  textDecoration: 'none', fontSize: '0.8rem',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Join
              </Link>
              <button
                onClick={() => dismissInvite(inv.id)}
                style={{
                  padding: '0.4rem 0.625rem',
                  borderRadius: '0.375rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem',
                }}
              >
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Search */}
      <div style={{ padding: '0.875rem 0.875rem 0' }}>
        <input
          type="text"
          placeholder="Search players by username…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.65rem 0.875rem',
            borderRadius: '0.625rem',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text)',
            fontSize: '0.875rem',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--p1-primary)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />

        {/* Search results */}
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{
                marginTop: '0.5rem',
                background: 'rgba(12,18,40,0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.75rem',
                overflow: 'hidden',
              }}
            >
              {searchResults.map((u) => {
                const status = requestStatus[u.username];
                const isFriend = friends.some((f) => f.userId === u.id);
                return (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.6rem 0.875rem', gap: '0.5rem',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <Avatar name={u.username} size={28} />
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{u.username}</p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>ELO {u.elo}</p>
                      </div>
                    </div>
                    {isFriend ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Friends</span>
                    ) : status === 'sent' ? (
                      <span style={{ fontSize: '0.75rem', color: '#4ade80' }}>Sent ✓</span>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(u.username)}
                        disabled={status === 'sending'}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.375rem',
                          border: '1px solid rgba(37,99,235,0.4)',
                          background: 'rgba(37,99,235,0.12)',
                          color: '#93c5fd', fontSize: '0.78rem', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'var(--font-display)',
                        }}
                      >
                        {status === 'sending' ? '…' : status === 'error' ? 'Retry' : '+ Add'}
                      </button>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0.25rem',
        padding: '0.75rem 0.875rem 0',
      }}>
        {(['friends', 'requests'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              flex: 1, padding: '0.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: activeTab === t ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeTab === t ? 'var(--text)' : 'var(--text-muted)',
              fontWeight: activeTab === t ? 700 : 500,
              fontSize: '0.8rem', fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {t === 'friends' ? `Friends${friends.length ? ` (${friends.length})` : ''}` : `Requests${pendingIn.length ? ` (${pendingIn.length})` : ''}`}
            {t === 'requests' && pendingIn.length > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--p2-primary)',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* List area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.875rem 0.875rem' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'friends' ? (
            <motion.div key="friends-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {friends.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
                  No friends yet. Search for players above.
                </p>
              ) : (
                friends.map((f) => (
                  <FriendCard
                    key={f.friendshipId}
                    friend={f}
                    roomCode={roomCode}
                    inviteStatus={inviteStatus[f.username ?? f.userId]}
                    challengeStatus={challengeStatus[f.username ?? f.userId]}
                    onInvite={() => f.username && handleInvite(f.username)}
                    onChallenge={() => f.username && handleChallenge(f.username)}
                    onRemove={() => {
                      if (confirmRemove === f.friendshipId) {
                        removeOrCancel(f.friendshipId);
                        setConfirmRemove(null);
                      } else {
                        setConfirmRemove(f.friendshipId);
                      }
                    }}
                    confirmingRemove={confirmRemove === f.friendshipId}
                    onCancelRemove={() => setConfirmRemove(null)}
                  />
                ))
              )}
            </motion.div>
          ) : (
            <motion.div key="requests-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {pendingIn.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
                  No pending requests.
                </p>
              ) : (
                pendingIn.map((req) => (
                  <div
                    key={req.friendshipId}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.625rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <Avatar name={req.username ?? '?'} size={32} />
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{req.username ?? 'Unknown'}</p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>Wants to be friends</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                      <button
                        onClick={() => acceptRequest(req.friendshipId)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.375rem',
                          border: 'none',
                          background: 'var(--p1-primary)',
                          color: '#fff', fontSize: '0.78rem', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'var(--font-display)',
                        }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => removeOrCancel(req.friendshipId)}
                        style={{
                          padding: '0.35rem 0.625rem',
                          borderRadius: '0.375rem',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.05)',
                          color: 'var(--text-muted)', fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PanelShell>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PanelShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: '22rem',
          background: 'rgba(10,15,35,0.98)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-24px 0 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Panel header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.125rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
            Friends
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-muted)', borderRadius: '50%',
              width: '1.75rem', height: '1.75rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: '0.8rem',
            }}
          >
            ✕
          </button>
        </div>

        {children}
      </motion.aside>
    </motion.div>
  );
}

function FriendCard({
  friend,
  roomCode,
  inviteStatus,
  challengeStatus,
  onInvite,
  onChallenge,
  onRemove,
  confirmingRemove,
  onCancelRemove,
}: {
  friend: import('../stores/friendsStore.js').Friend;
  roomCode?: string;
  inviteStatus?: 'sending' | 'sent' | 'error';
  challengeStatus?: 'sending' | 'sent' | 'error';
  onInvite: () => void;
  onChallenge: () => void;
  onRemove: () => void;
  confirmingRemove: boolean;
  onCancelRemove: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '0.625rem 0',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      gap: '0.625rem',
    }}>
      <Avatar name={friend.username ?? '?'} size={34} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            to={friend.username ? `/profile/${friend.username}` : '#'}
            style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text)', textDecoration: 'none' }}
            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
          >
            {friend.username ?? 'Unknown'}
          </Link>
          <span style={{
            fontSize: '0.7rem', padding: '0.1rem 0.375rem',
            borderRadius: '0.25rem', background: 'rgba(37,99,235,0.15)',
            color: '#93c5fd', fontWeight: 600, fontFamily: 'var(--font-display)',
          }}>
            {friend.elo}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0, alignItems: 'center' }}>
        {roomCode ? (
          inviteStatus === 'sent' ? (
            <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>Invited ✓</span>
          ) : (
            <button
              onClick={onInvite}
              disabled={inviteStatus === 'sending'}
              title="Invite to this game"
              style={{
                padding: '0.35rem 0.625rem',
                borderRadius: '0.375rem',
                border: '1px solid rgba(234,88,12,0.4)',
                background: 'rgba(234,88,12,0.12)',
                color: '#fdba74', fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-display)',
              }}
            >
              {inviteStatus === 'sending' ? '…' : 'Invite'}
            </button>
          )
        ) : (
          challengeStatus === 'sent' ? (
            <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>Challenged ✓</span>
          ) : (
            <button
              onClick={onChallenge}
              disabled={challengeStatus === 'sending'}
              title="Challenge friend"
              style={{
                padding: '0.35rem 0.625rem',
                borderRadius: '0.375rem',
                border: '1px solid rgba(234,88,12,0.4)',
                background: 'rgba(234,88,12,0.12)',
                color: '#fdba74', fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-display)',
              }}
            >
              {challengeStatus === 'sending' ? '…' : challengeStatus === 'error' ? 'Retry' : 'Challenge'}
            </button>
          )
        )}

        {/* Remove */}
        {confirmingRemove ? (
          <>
            <button
              onClick={onRemove}
              style={{
                padding: '0.3rem 0.5rem',
                borderRadius: '0.375rem', border: 'none',
                background: 'rgba(239,68,68,0.2)', color: '#f87171',
                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Confirm
            </button>
            <button
              onClick={onCancelRemove}
              style={{
                padding: '0.3rem 0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={onRemove}
            title="Remove friend"
            style={{
              padding: '0.3rem 0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent',
              color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function Avatar({ name, size }: { name: string; size: number }) {
  const initial = name?.[0]?.toUpperCase() ?? '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--p1-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: '#fff',
      flexShrink: 0, fontFamily: 'var(--font-display)',
    }}>
      {initial}
    </div>
  );
}
