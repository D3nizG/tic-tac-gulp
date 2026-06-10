import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuthStore } from '../stores/authStore.js';
import { useFriendsStore } from '../stores/friendsStore.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  gulps: number;
  canViewRecentGames: boolean;
}

interface MatchRecord {
  id: string;
  opponentUsername: string | null;
  result: 'W' | 'L' | 'D';
  endReason: string;
  moveCount: number;
  durationMs: number | null;
  playedAt: string;
}

export default function ProfilePage() {
  const { username: usernameParam } = useParams<{ username?: string }>();
  const navigate = useNavigate();
  const { user, getToken } = useAuthStore();
  const { friends, fetchFriends, sendRequest, removeOrCancel } = useFriendsStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Own profile: resolve username from auth, then redirect
  const [ownUsername, setOwnUsername] = useState<string | null>(null);

  // Friend actions
  const [friendAction, setFriendAction] = useState<'idle' | 'sending' | 'sent' | 'removing'>('idle');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameSaveError, setUsernameSaveError] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);

  useEffect(() => {
    // If no username param, fetch own profile first
    if (!usernameParam) {
      if (!user) { navigate('/login'); return; }
      const token = getToken();
      fetch(`${SOCKET_URL}/api/users/me`, { headers: authHeaders(token) })
        .then((r) => r.json())
        .then((data) => {
          if (data.username) {
            setOwnUsername(data.username);
            navigate(`/profile/${data.username}`, { replace: true });
          } else {
            navigate('/login');
          }
        })
        .catch(() => navigate('/login'));
      return;
    }

    const token = getToken();
    setLoading(true);
    setError('');

    fetch(`${SOCKET_URL}/api/users/${usernameParam}`, { headers: authHeaders(token) })
      .then((r) => r.json())
      .then(async (profileData) => {
        if (profileData.error) { setError(profileData.error); return; }
        setProfile(profileData);
        setUsernameDraft(profileData.username);
        if (profileData.canViewRecentGames) {
          const matchData = await fetch(`${SOCKET_URL}/api/users/${usernameParam}/matches?limit=10`, { headers: authHeaders(token) })
            .then((r) => r.ok ? r.json() : []);
          setMatches(Array.isArray(matchData) ? matchData : []);
        } else {
          setMatches([]);
        }
      })
      .catch(() => setError('Failed to load profile.'))
      .finally(() => setLoading(false));

    // Refresh friends list for button state
    if (user) fetchFriends();
  }, [usernameParam, user]);

  if (!usernameParam || loading) {
    return (
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--bg)' }}>
        <Skeleton />
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--bg)', gap: '1rem' }}>
        <p style={{ color: '#f87171', fontSize: '1rem' }}>{error}</p>
        <button onClick={() => navigate('/')} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>← Home</button>
      </main>
    );
  }

  if (!profile) return null;

  const isOwnProfile = user && (ownUsername === profile.username || profile.id === user.id);
  const existingFriendship = friends.find((f) => f.userId === profile.id);
  const totalGames = profile.wins + profile.losses + profile.draws;
  const winRate = totalGames > 0 ? Math.round((profile.wins / totalGames) * 100) : 0;

  async function handleAddFriend() {
    setFriendAction('sending');
    const { error } = await sendRequest(profile!.username);
    setFriendAction(error ? 'idle' : 'sent');
  }

  async function handleRemoveFriend() {
    if (!existingFriendship) return;
    if (!confirmRemove) { setConfirmRemove(true); return; }
    setFriendAction('removing');
    await removeOrCancel(existingFriendship.friendshipId);
    setFriendAction('idle');
    setConfirmRemove(false);
  }

  async function handleSaveUsername() {
    const trimmed = usernameDraft.trim();
    if (trimmed.length < 3 || trimmed.length > 20) return;
    setUsernameSaving(true);
    setUsernameSaveError('');
    try {
      const res = await fetch(`${SOCKET_URL}/api/users/me`, {
        method: 'PUT',
        headers: authHeaders(getToken()),
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUsernameSaveError(data.error ?? 'Failed to save username.');
        return;
      }
      setProfile((current) => current ? { ...current, username: data.username } : current);
      setEditingUsername(false);
      navigate(`/profile/${data.username}`, { replace: true });
    } catch {
      setUsernameSaveError('Network error. Please try again.');
    } finally {
      setUsernameSaving(false);
    }
  }

  return (
    <main style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      padding: '2rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Back */}
      <div style={{ width: '100%', maxWidth: '28rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-body)', padding: 0,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: '28rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Profile header card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          style={{
            background: 'rgba(20,28,51,0.8)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '1.25rem',
            padding: '1.75rem',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
            {/* Avatar */}
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--p1-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', fontWeight: 800, color: '#fff',
              fontFamily: 'var(--font-display)',
              boxShadow: '0 0 20px rgba(37,99,235,0.4)',
              flexShrink: 0,
            }}>
              {profile.username[0].toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {isOwnProfile && editingUsername ? (
                <div>
                  <input
                    value={usernameDraft}
                    onChange={(e) => setUsernameDraft(e.target.value)}
                    maxLength={20}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.6rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-display)',
                      fontSize: '1rem',
                      fontWeight: 800,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveUsername();
                      if (e.key === 'Escape') {
                        setEditingUsername(false);
                        setUsernameDraft(profile.username);
                      }
                    }}
                  />
                  {usernameSaveError && (
                    <p style={{ margin: '0.35rem 0 0', color: '#f87171', fontSize: '0.72rem' }}>
                      {usernameSaveError}
                    </p>
                  )}
                </div>
              ) : (
                <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                  {profile.username}
                </h1>
              )}
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Friend / own profile button */}
            {isOwnProfile && (
              <div style={{ flexShrink: 0, display: 'flex', gap: '0.375rem' }}>
                {editingUsername ? (
                  <>
                    <button
                      onClick={handleSaveUsername}
                      disabled={usernameSaving || usernameDraft.trim().length < 3}
                      style={{
                        padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: 'none',
                        background: 'var(--p1-primary)', color: '#fff',
                        fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {usernameSaving ? '...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingUsername(false); setUsernameDraft(profile.username); setUsernameSaveError(''); }}
                      style={{
                        padding: '0.4rem 0.625rem', borderRadius: '0.5rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'transparent', color: 'var(--text-muted)',
                        fontSize: '0.78rem', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditingUsername(true)}
                    style={{
                      padding: '0.4rem 1rem', borderRadius: '0.5rem',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--text-muted)', fontSize: '0.82rem',
                      fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
            {!isOwnProfile && user && (
              <div style={{ flexShrink: 0 }}>
                {existingFriendship ? (
                  confirmRemove ? (
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button
                        onClick={handleRemoveFriend}
                        style={{
                          padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: 'none',
                          background: 'rgba(239,68,68,0.2)', color: '#f87171',
                          fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmRemove(false)}
                        style={{
                          padding: '0.4rem 0.625rem', borderRadius: '0.5rem',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'transparent', color: 'var(--text-muted)',
                          fontSize: '0.78rem', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleRemoveFriend}
                      disabled={friendAction === 'removing'}
                      style={{
                        padding: '0.4rem 1rem', borderRadius: '0.5rem',
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-muted)', fontSize: '0.82rem',
                        fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      Friends ✓
                    </button>
                  )
                ) : (
                  <button
                    onClick={handleAddFriend}
                    disabled={friendAction === 'sending' || friendAction === 'sent'}
                    style={{
                      padding: '0.4rem 1rem', borderRadius: '0.5rem',
                      border: 'none',
                      background: friendAction === 'sent'
                        ? 'rgba(74,222,128,0.15)'
                        : 'linear-gradient(135deg, var(--p1-primary) 0%, #1d4ed8 100%)',
                      color: friendAction === 'sent' ? '#4ade80' : '#fff',
                      fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {friendAction === 'sent' ? 'Request Sent' : friendAction === 'sending' ? '…' : '+ Add Friend'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.6rem' }}>
            {[
              { label: 'Wins', value: profile.wins, color: '#4ade80' },
              { label: 'Losses', value: profile.losses, color: '#f87171' },
              { label: 'Ties', value: profile.draws, color: '#94a3b8' },
              { label: 'Win %', value: `${winRate}%`, color: 'var(--text)' },
              { label: 'Gulps', value: profile.gulps, color: 'var(--highlight)' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  textAlign: 'center',
                  padding: '0.75rem 0.5rem',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color, fontFamily: 'var(--font-display)' }}>
                  {value}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent matches */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.08 }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-display)', margin: '0 0 0.75rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Recent Matches
          </h2>

          {!profile.canViewRecentGames ? (
            <div style={{
              padding: '2rem',
              background: 'rgba(20,28,51,0.6)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '1rem',
              textAlign: 'center',
              color: 'var(--text-muted)', fontSize: '0.875rem',
            }}>
              Recent games are visible to friends only.
            </div>
          ) : matches.length === 0 ? (
            <div style={{
              padding: '2rem',
              background: 'rgba(20,28,51,0.6)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '1rem',
              textAlign: 'center',
              color: 'var(--text-muted)', fontSize: '0.875rem',
            }}>
              No matches played yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {matches.map((m, i) => (
                <MatchRow key={m.id} match={m} index={i} />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}

function MatchRow({ match, index }: { match: MatchRecord; index: number }) {
  const resultColor = match.result === 'W' ? '#4ade80' : match.result === 'L' ? '#f87171' : '#94a3b8';
  const resultLabel = match.result === 'W' ? 'Win' : match.result === 'L' ? 'Loss' : 'Draw';
  const durationSec = match.durationMs ? Math.round(match.durationMs / 1000) : null;
  const playedDate = new Date(match.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '0.75rem 1rem',
        background: 'rgba(20,28,51,0.6)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '0.75rem',
        gap: '0.75rem',
      }}
    >
      {/* Result badge */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: `${resultColor}18`,
        border: `1px solid ${resultColor}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 800, color: resultColor,
        fontFamily: 'var(--font-display)', flexShrink: 0,
      }}>
        {match.result}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
          {resultLabel} · {match.endReason === 'resign' ? 'Resignation' : match.endReason === 'forfeit' ? 'Forfeit' : 'Three in a row'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
          vs{' '}
          {match.opponentUsername ? (
            <Link
              to={`/profile/${match.opponentUsername}`}
              style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
            >
              {match.opponentUsername}
            </Link>
          ) : (
            'Guest'
          )}
          {' · '}{match.moveCount} moves
          {durationSec !== null && ` · ${durationSec}s`}
        </div>
      </div>

      {/* Date */}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
        {playedDate}
      </div>
    </motion.div>
  );
}

function Skeleton() {
  return (
    <div style={{ width: '100%', maxWidth: '28rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '2rem 1rem' }}>
      {[1, 0.5, 0.75].map((opacity, i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? 200 : 80,
            borderRadius: '1rem',
            background: `rgba(255,255,255,${0.03 * opacity})`,
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        />
      ))}
    </div>
  );
}
