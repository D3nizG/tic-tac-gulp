import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGameStore } from '../stores/gameStore.js';
import { emitChat } from '../stores/socketStore.js';

const PLAYER_COLORS: Record<string, string> = {
  P1: 'var(--p1-primary)',
  P2: 'var(--p2-primary)',
};

export default function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const chatMessages = useGameStore((s) => s.chatMessages);
  const unreadChat = useGameStore((s) => s.unreadChat);
  const clearUnreadChat = useGameStore((s) => s.clearUnreadChat);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);
  const gameState = useGameStore((s) => s.gameState);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, open]);

  // Clear unread when opening
  useEffect(() => {
    if (open) clearUnreadChat();
  }, [open, clearUnreadChat]);

  if (!gameState || !yourPlayerId) return null;
  if (gameState.status !== 'IN_PROGRESS' && gameState.status !== 'ENDED') return null;

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    emitChat(text);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Toggle chat"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '2.25rem',
          height: '2.25rem',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.1)',
          background: open ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
          cursor: 'pointer',
          color: open ? '#fff' : 'rgba(255,255,255,0.4)',
          transition: 'background 0.15s, color 0.15s',
          flexShrink: 0,
        }}
      >
        {/* Chat bubble icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 2h10a1 1 0 011 1v6a1 1 0 01-1 1H8l-3 2.5V10H2a1 1 0 01-1-1V3a1 1 0 011-1z"
            stroke="currentColor"
            strokeWidth="1.3"
            fill="none"
            strokeLinejoin="round"
          />
        </svg>
        {/* Unread badge */}
        {!open && unreadChat > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              minWidth: '1rem',
              height: '1rem',
              borderRadius: '0.5rem',
              background: 'var(--p2-primary)',
              color: '#fff',
              fontSize: '0.6rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingInline: '0.2rem',
              fontFamily: 'var(--font-display)',
            }}
          >
            {unreadChat > 9 ? '9+' : unreadChat}
          </motion.div>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 0.5rem)',
              right: 0,
              width: '18rem',
              maxWidth: '90vw',
              background: 'var(--surface)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '1rem',
              overflow: 'hidden',
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 50,
            }}
          >
            {/* Header */}
            <div style={{
              padding: '0.625rem 0.875rem',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.75rem',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              Chat
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              maxHeight: '14rem',
              overflowY: 'auto',
              padding: '0.625rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
              scrollbarWidth: 'none',
            }}>
              {chatMessages.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.2)',
                  fontSize: '0.75rem',
                  padding: '1.5rem 0',
                  fontFamily: 'var(--font-body)',
                }}>
                  No messages yet
                </div>
              ) : (
                chatMessages.map((msg, i) => {
                  const isYours = msg.playerId === yourPlayerId;
                  const color = PLAYER_COLORS[msg.playerId];
                  const name = gameState.players[msg.playerId as 'P1' | 'P2']?.displayName ?? msg.playerId;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        alignSelf: isYours ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                      }}
                    >
                      {!isYours && (
                        <div style={{
                          fontSize: '0.6rem',
                          color,
                          fontWeight: 700,
                          fontFamily: 'var(--font-display)',
                          marginBottom: '0.15rem',
                          paddingLeft: '0.5rem',
                        }}>
                          {name}
                        </div>
                      )}
                      <div style={{
                        padding: '0.4rem 0.625rem',
                        borderRadius: isYours ? '0.75rem 0.75rem 0.15rem 0.75rem' : '0.75rem 0.75rem 0.75rem 0.15rem',
                        background: isYours
                          ? `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`
                          : 'rgba(255,255,255,0.06)',
                        color: isYours ? '#fff' : 'var(--text)',
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-body)',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}>
                        {msg.text}
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: '0.5rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              gap: '0.375rem',
            }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 200))}
                onKeyDown={handleKeyDown}
                placeholder="Message…"
                maxLength={200}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.625rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text)',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                style={{
                  padding: '0.45rem 0.625rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: input.trim() ? 'var(--p1-primary)' : 'rgba(255,255,255,0.05)',
                  color: input.trim() ? '#fff' : 'rgba(255,255,255,0.2)',
                  cursor: input.trim() ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Send arrow icon */}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 11L11 6L1 1V5l7 1-7 1v4z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
