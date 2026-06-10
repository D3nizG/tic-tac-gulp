import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { useFriendsStore } from '../stores/friendsStore.js';
import { supabase, supabaseEnabled } from '../lib/supabase.js';
import type { GameInvite } from '../stores/friendsStore.js';

/**
 * Subscribes to real-time game_invites inserts for the current user
 * and renders a fixed toast in the bottom-right corner.
 */
export default function InviteToast() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { invites, fetchInvites, acceptGameInvite, dismissInvite } = useFriendsStore();
  const [joining, setJoining] = useState<Record<string, boolean>>({});

  // Subscribe to Supabase Realtime for new game invites
  useEffect(() => {
    if (!user) return;

    // Initial fetch
    fetchInvites();

    const poll = window.setInterval(fetchInvites, 3500);

    if (!supabaseEnabled) {
      return () => window.clearInterval(poll);
    }

    const channel = supabase
      .channel(`game_invites_${user.id}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_invites',
          filter: `to_user_id=eq.${user.id}`,
        },
        () => {
          // Re-fetch to get full invite data including sender username
          fetchInvites();
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  async function handleJoinInvite(invite: GameInvite) {
    setJoining((s) => ({ ...s, [invite.id]: true }));
    const { error, roomCode } = await acceptGameInvite(invite);
    setJoining((s) => ({ ...s, [invite.id]: false }));
    if (error || !roomCode) return;
    navigate(`/room/${roomCode}`);
  }

  if (invites.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      zIndex: 200,
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
      pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {invites.map((inv) => (
          <motion.div
            key={inv.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            style={{
              background: 'rgba(10,15,35,0.97)',
              border: '1px solid rgba(37,99,235,0.4)',
              borderRadius: '0.875rem',
              padding: '0.875rem 1rem',
              minWidth: '15rem', maxWidth: '20rem',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(37,99,235,0.15)',
              pointerEvents: 'auto',
            }}
          >
            {/* Pulsing indicator */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--p1-primary)',
                  flexShrink: 0, marginTop: 4,
                }}
              />
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 0.15rem', fontWeight: 700, fontSize: '0.875rem', fontFamily: 'var(--font-display)' }}>
                  Game Invite!
                </p>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--text)' }}>{inv.fromUsername ?? 'Someone'}</strong>{' '}
                  invited you to room <strong style={{ color: 'var(--highlight)', fontFamily: 'var(--font-display)' }}>{inv.roomCode}</strong>
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleJoinInvite(inv)}
                    disabled={joining[inv.id]}
                    style={{
                      flex: 1, padding: '0.45rem 0',
                      borderRadius: '0.375rem',
                      border: 'none',
                      background: 'linear-gradient(135deg, var(--p1-primary) 0%, #1d4ed8 100%)',
                      color: '#fff', fontWeight: 700,
                      fontSize: '0.8rem',
                      textAlign: 'center', fontFamily: 'var(--font-display)',
                      cursor: joining[inv.id] ? 'wait' : 'pointer',
                    }}
                  >
                    {joining[inv.id] ? 'Joining...' : 'Join Game'}
                  </button>
                  <button
                    onClick={() => dismissInvite(inv.id)}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '0.375rem',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem', cursor: 'pointer',
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
