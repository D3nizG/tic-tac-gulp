import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useGameStore } from '../stores/gameStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { useFriendsStore } from '../stores/friendsStore.js';
import type { PlayerId } from '@tic-tac-gulp/shared';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

const PLAYER_COLORS: Record<PlayerId, { primary: string; label: string }> = {
  P1: { primary: 'var(--p1-primary)', label: 'Blue' },
  P2: { primary: 'var(--p2-primary)', label: 'Orange' },
};

interface PublicProfile {
  id: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  gulps: number;
}

interface Props {
  opponentId: PlayerId;
  onClose: () => void;
}

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export default function OpponentOverlay({ opponentId, onClose }: Props) {
  const gameState = useGameStore((s) => s.gameState);
  const sessionStats = useGameStore((s) => s.sessionStats);
  const user = useAuthStore((s) => s.user);
  const getToken = useAuthStore((s) => s.getToken);
  const { friends, fetchFriends, sendRequest } = useFriendsStore();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [friendStatus, setFriendStatus] = useState<'idle' | 'sending' | 'sent' | 'accepted' | 'error'>('idle');

  const player = gameState?.players[opponentId];

  useEffect(() => {
    if (!user) return;
    fetchFriends();
  }, [user?.id, fetchFriends]);

  useEffect(() => {
    setProfile(null);
    setProfileLoading(false);
    setFriendStatus('idle');

    if (!player?.userId || !player.displayName) return;

    let cancelled = false;
    setProfileLoading(true);
    fetch(`${SOCKET_URL}/api/users/${encodeURIComponent(player.displayName)}`, {
      headers: authHeaders(getToken()),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [player?.userId, player?.displayName, getToken]);

  if (!gameState || !player) return null;

  const { primary, label } = PLAYER_COLORS[opponentId];
  const isFriend = friends.some((f) => f.userId === player.userId);
  const canAddFriend = Boolean(user && player.userId && player.userId !== user.id && !isFriend);

  const inProgressGulps = gameState.status === 'IN_PROGRESS'
    ? gameState.gulpCounts[opponentId] ?? 0
    : 0;
  const sessionRecord = {
    wins: sessionStats.losses,
    losses: sessionStats.wins,
    draws: sessionStats.draws,
    gulps: sessionStats.opponentGulps + inProgressGulps,
    elo: null as number | null,
  };
  const record = profile
    ? {
      wins: profile.wins,
      losses: profile.losses,
      draws: profile.draws,
      gulps: profile.gulps,
      elo: profile.elo,
    }
    : sessionRecord;
  const recordLabel = profile ? 'Career Record' : 'This Session';
  const totalGames = record.wins + record.losses + record.draws;
  const winRate = totalGames > 0 ? Math.round((record.wins / totalGames) * 100) : 0;

  async function handleAddFriend() {
    if (!player?.displayName) return;
    setFriendStatus('sending');
    const { error, status } = await sendRequest(player.displayName);
    if (error) {
      setFriendStatus('error');
      return;
    }
    setFriendStatus(status === 'accepted' ? 'accepted' : 'sent');
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        style={{
          position: 'absolute',
          top: 'calc(100% + 0.5rem)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '15.5rem',
          background: 'var(--surface)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '1rem',
          padding: '1.25rem',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
          <div style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: '50%',
            background: primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '0.875rem',
            fontWeight: 800,
            color: '#fff',
            fontFamily: 'var(--font-display)',
          }}>
            {player.displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontWeight: 700,
              fontSize: '0.9rem',
              fontFamily: 'var(--font-display)',
              color: 'var(--text)',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {player.displayName}
            </div>
            <div style={{
              fontSize: '0.65rem',
              color: primary,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              {opponentId} - {label}
            </div>
          </div>
        </div>

        {canAddFriend && (
          <button
            onClick={handleAddFriend}
            disabled={friendStatus === 'sending' || friendStatus === 'sent' || friendStatus === 'accepted'}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: friendStatus === 'sent'
                ? '1px solid rgba(74,222,128,0.45)'
                : '1px solid rgba(37,99,235,0.45)',
              background: friendStatus === 'sent'
                ? 'rgba(74,222,128,0.12)'
                : 'rgba(37,99,235,0.14)',
              color: friendStatus === 'sent' ? '#4ade80' : '#93c5fd',
              fontSize: '0.75rem',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              cursor: friendStatus === 'sending' || friendStatus === 'sent' || friendStatus === 'accepted'
                ? 'default'
                : 'pointer',
            }}
          >
            {friendStatus === 'sending'
              ? 'Sending...'
              : friendStatus === 'accepted'
              ? 'Friends'
              : friendStatus === 'sent'
              ? 'Request sent'
              : friendStatus === 'error'
              ? 'Retry add friend'
              : 'Add friend'}
          </button>
        )}

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.6rem',
          }}>
            <div style={{
              fontSize: '0.6rem',
              color: 'var(--text-muted)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-display)',
            }}>
              {recordLabel}
            </div>
            {record.elo !== null && (
              <div style={{
                fontSize: '0.65rem',
                color: '#93c5fd',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
              }}>
                ELO {record.elo}
              </div>
            )}
          </div>

          {profileLoading ? (
            <div style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.3)',
              fontFamily: 'var(--font-body)',
            }}>
              Loading record...
            </div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.55rem',
              }}>
                {[
                  { label: 'W', value: record.wins, color: 'var(--highlight)' },
                  { label: 'L', value: record.losses, color: '#f87171' },
                  { label: 'D', value: record.draws, color: 'var(--text-muted)' },
                  { label: 'G', value: record.gulps, color: primary },
                ].map(({ label: metricLabel, value, color }) => (
                  <div key={metricLabel} style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-display)',
                      color,
                      lineHeight: 1,
                    }}>
                      {value}
                    </div>
                    <div style={{
                      fontSize: '0.56rem',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      fontFamily: 'var(--font-display)',
                    }}>
                      {metricLabel}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: '0.75rem',
                fontSize: '0.7rem',
                color: 'rgba(255,255,255,0.34)',
                fontFamily: 'var(--font-body)',
                textAlign: 'center',
              }}>
                {totalGames > 0 ? `${winRate}% win rate over ${totalGames} games` : 'No completed games yet'}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}
