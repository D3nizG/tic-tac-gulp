import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const STEPS = [
  {
    id: 'goal',
    title: 'The Goal',
    subtitle: 'Get 3 in a row — but pieces can be stolen.',
    content: <GoalStep />,
  },
  {
    id: 'pieces',
    title: 'Your Pieces',
    subtitle: 'Each player gets 3 Small, 2 Medium, and 1 Large.',
    content: <PiecesStep />,
  },
  {
    id: 'gulp',
    title: 'Gulping',
    subtitle: 'Place a larger piece on a smaller one to gulp it.',
    content: <GulpStep />,
  },
  {
    id: 'win',
    title: 'Winning',
    subtitle: "Three of your pieces in a row — but watch for gulps.",
    content: <WinStep />,
  },
] as const;

interface Props {
  onClose: () => void;
}

export default function HowToPlayOverlay({ onClose }: Props) {
  const [step, setStep] = useState(0);

  function prev() { setStep((s) => Math.max(0, s - 1)); }
  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else onClose();
  }

  const current = STEPS[step];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(12,18,40,0.97)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '1.5rem',
          width: '100%',
          maxWidth: '28rem',
          overflow: 'hidden',
          boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem 0',
        }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
          }}>
            How to Play
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '0.25rem', lineHeight: 1,
              borderRadius: '0.375rem',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div style={{
          display: 'flex', gap: '0.35rem', padding: '0.75rem 1.5rem 0',
          alignItems: 'center',
        }}>
          {STEPS.map((s, i) => (
            <motion.button
              key={s.id}
              onClick={() => setStep(i)}
              animate={{
                width: i === step ? 24 : 8,
                background: i === step
                  ? 'var(--highlight)'
                  : i < step
                  ? 'rgba(255,255,255,0.35)'
                  : 'rgba(255,255,255,0.12)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              style={{
                height: 4, borderRadius: 2, border: 'none', cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>

        {/* Content area */}
        <div style={{ padding: '1.5rem 1.5rem 0' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18 }}
            >
              <h2 style={{
                margin: '0 0 0.35rem',
                fontSize: '1.5rem',
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.01em',
              }}>
                {current.title}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                {current.subtitle}
              </p>

              {/* Illustration area */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '1rem',
                padding: '1.5rem',
                minHeight: '11rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {current.content}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          padding: '1.25rem 1.5rem 1.5rem',
        }}>
          <button
            onClick={prev}
            disabled={step === 0}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '0.625rem',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: step === 0 ? 'var(--text-muted)' : 'var(--text)',
              fontSize: '0.9rem',
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              cursor: step === 0 ? 'not-allowed' : 'pointer',
              opacity: step === 0 ? 0.4 : 1,
              transition: 'opacity 0.15s, background 0.15s',
            }}
          >
            Back
          </button>
          <button
            onClick={next}
            style={{
              flex: 2,
              padding: '0.75rem',
              borderRadius: '0.625rem',
              border: 'none',
              background: 'linear-gradient(135deg, var(--p1-primary) 0%, #1d4ed8 100%)',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.03em',
              cursor: 'pointer',
              boxShadow: '0 0 14px rgba(37,99,235,0.35)',
            }}
          >
            {step < STEPS.length - 1 ? 'Next →' : 'Got it!'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Step illustrations ──────────────────────────────────────────────────────

function GoalStep() {
  const board = [
    ['P1', null, 'P2'],
    [null, 'P1', null],
    ['P2', null, 'P1'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        {board.flat().map((cell, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.04, type: 'spring', stiffness: 350, damping: 24 }}
            style={{
              width: 52, height: 52,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {cell && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: cell === 'P1' ? 'var(--p1-primary)' : 'var(--p2-primary)',
                boxShadow: cell === 'P1'
                  ? '0 0 10px rgba(37,99,235,0.6)'
                  : '0 0 10px rgba(234,88,12,0.6)',
              }} />
            )}
          </motion.div>
        ))}
      </div>
      {/* Win line highlight for the diagonal */}
      <p style={{ fontSize: '0.78rem', color: 'rgba(37,99,235,0.9)', fontWeight: 600, margin: 0, letterSpacing: '0.04em' }}>
        Blue wins — diagonal!
      </p>
    </div>
  );
}

function PiecesStep() {
  const sizes: Array<{ label: string; r: number; count: number }> = [
    { label: 'Small', r: 14, count: 3 },
    { label: 'Medium', r: 22, count: 2 },
    { label: 'Large', r: 30, count: 1 },
  ];
  return (
    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-end', justifyContent: 'center' }}>
      {sizes.map(({ label, r, count }, si) => (
        <motion.div
          key={label}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: si * 0.1, type: 'spring', stiffness: 360, damping: 22 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
            {Array.from({ length: count }).map((_, pi) => (
              <div
                key={pi}
                style={{
                  width: r * 2, height: r * 2, borderRadius: '50%',
                  background: 'var(--p1-primary)',
                  boxShadow: `0 0 ${r}px rgba(37,99,235,0.4)`,
                  opacity: 1 - pi * 0.15,
                }}
              />
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {label}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>×{count}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function GulpStep() {
  const [phase, setPhase] = useState<0 | 1 | 2>(0);

  // Auto-animate
  useState(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 1600);
    const t3 = setTimeout(() => setPhase(0), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {/* Small piece (P1) */}
        <div style={{
          width: 52, height: 52,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {/* P1 small piece — remains visible until gulped */}
          <AnimatePresence>
            {phase < 2 && (
              <motion.div
                key="small"
                initial={{ scale: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--p1-primary)',
                  boxShadow: '0 0 8px rgba(37,99,235,0.5)',
                  position: 'absolute',
                }}
              />
            )}
          </AnimatePresence>
          {/* P2 large piece flies in */}
          <AnimatePresence>
            {phase >= 1 && (
              <motion.div
                key="large"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: 'var(--p2-primary)',
                  boxShadow: '0 0 16px rgba(234,88,12,0.5)',
                  position: 'absolute',
                  zIndex: 2,
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Label */}
        <div style={{ textAlign: 'center', minWidth: '5rem' }}>
          <AnimatePresence mode="wait">
            {phase === 0 && (
              <motion.p key="p0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                P2 plays Large<br />on P1's Small…
              </motion.p>
            )}
            {phase === 1 && (
              <motion.p key="p1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ margin: 0, fontSize: '0.8rem', color: 'var(--p2-primary)', fontWeight: 700 }}>
                Gulp!
              </motion.p>
            )}
            {phase === 2 && (
              <motion.p key="p2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                P1's piece is<br />hidden underneath
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div style={{
        fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic',
        textAlign: 'center', lineHeight: 1.4,
      }}>
        L gulps M or S · M gulps S only · S cannot gulp
      </div>
    </div>
  );
}

function WinStep() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', position: 'relative' }}>
        {[
          { color: 'P2', size: 28 }, { color: 'P1', size: 20 }, { color: 'P1', size: 36 },
          { color: 'P1', size: 20 }, { color: 'P1', size: 36 }, { color: 'P2', size: 20 },
          { color: 'P2', size: 28 }, { color: 'P2', size: 20 }, { color: 'P1', size: 28 },
        ].map((cell, i) => {
          // Top-right → middle → bottom-left diagonal win for P1 (indices 2, 4, 6)
          const isWin = [2, 4, 6].includes(i) && cell.color === 'P1';
          return (
            <motion.div
              key={i}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 350, damping: 24 }}
              style={{
                width: 52, height: 52,
                borderRadius: 8,
                background: isWin ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.05)',
                border: isWin ? '1px solid rgba(37,99,235,0.4)' : '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{
                width: cell.size, height: cell.size, borderRadius: '50%',
                background: cell.color === 'P1' ? 'var(--p1-primary)' : 'var(--p2-primary)',
                boxShadow: isWin ? '0 0 16px rgba(37,99,235,0.7)' : 'none',
              }} />
            </motion.div>
          );
        })}
      </div>
      <p style={{ fontSize: '0.78rem', color: 'rgba(37,99,235,0.9)', fontWeight: 600, margin: 0, letterSpacing: '0.04em' }}>
        Blue wins — but the gulped piece under index 2 still counts!
      </p>
      <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
        A gulped piece that would complete a line doesn't count.<br />
        The top piece's owner claims the cell.
      </p>
    </div>
  );
}
