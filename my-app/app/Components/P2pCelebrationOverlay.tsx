'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';

export type P2pCongratsDetail = {
  leadId?: number;
  leadName?: string;
  designerName?: string;
};

type Balloon = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  drift: number;
};

const BALLOON_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];

function buildBalloons(count: number): Balloon[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 4 + ((i * 17) % 92),
    delay: (i % 8) * 0.18,
    duration: 4.2 + (i % 5) * 0.55,
    size: 28 + (i % 6) * 6,
    color: BALLOON_COLORS[i % BALLOON_COLORS.length],
    drift: (i % 2 === 0 ? 1 : -1) * (12 + (i % 5) * 4),
  }));
}

/**
 * Full-screen celebration when a designer completes Push-to-Production (last milestone).
 * Triggered via `window` event `design-p2p-congrats`.
 */
export default function P2pCelebrationOverlay() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<P2pCongratsDetail>({});
  const balloons = useMemo(() => buildBalloons(18), []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onCongrats = (e: Event) => {
      const ce = e as CustomEvent<P2pCongratsDetail>;
      setDetail(ce.detail || {});
      setOpen(true);
    };
    window.addEventListener('design-p2p-congrats', onCongrats as EventListener);
    return () => window.removeEventListener('design-p2p-congrats', onCongrats as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(close, 9000);
    return () => window.clearTimeout(t);
  }, [open, close]);

  if (!open) return null;

  const name = (detail.designerName || 'Designer').trim() || 'Designer';
  const lead = (detail.leadName || '').trim();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1a120c]/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Push to production congratulations"
      onClick={close}
    >
      <style>{`
        @keyframes p2p-balloon-rise {
          0% { transform: translate3d(0, 110vh, 0) scale(0.85); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate3d(var(--drift), -20vh, 0) scale(1); opacity: 0.85; }
        }
        @keyframes p2p-pop-in {
          0% { transform: scale(0.72); opacity: 0; }
          55% { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes p2p-confetti {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(70vh) rotate(540deg); opacity: 0; }
        }
        @keyframes p2p-spark {
          0%, 100% { opacity: 0.35; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>

      {/* Balloons */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {balloons.map((b) => (
          <span
            key={b.id}
            className="absolute bottom-0"
            style={
              {
                left: `${b.left}%`,
                width: b.size,
                height: b.size * 1.25,
                animation: `p2p-balloon-rise ${b.duration}s ease-out ${b.delay}s both`,
                ['--drift' as string]: `${b.drift}px`,
              } as CSSProperties
            }
          >
            <span
              className="block h-[70%] w-full rounded-full shadow-md"
              style={{
                background: `radial-gradient(circle at 30% 28%, #fff8, transparent 45%), ${b.color}`,
              }}
            />
            <span
              className="mx-auto mt-[-2px] block h-[30%] w-[2px]"
              style={{ background: 'rgba(50,38,28,0.35)' }}
            />
          </span>
        ))}
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={`c-${i}`}
            className="absolute top-0 h-2 w-2 rounded-[2px]"
            style={{
              left: `${(i * 13) % 100}%`,
              background: BALLOON_COLORS[i % BALLOON_COLORS.length],
              animation: `p2p-confetti ${2.8 + (i % 5) * 0.4}s linear ${i * 0.08}s both`,
            }}
          />
        ))}
      </div>

      <div
        className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-[#E8DFD4] bg-gradient-to-b from-[#FFF9F3] to-[#F3E8DC] px-8 py-10 text-center shadow-2xl"
        style={{ animation: 'p2p-pop-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EF0101]/10"
          style={{ animation: 'p2p-spark 1.4s ease-in-out infinite' }}
          aria-hidden
        >
          <svg viewBox="0 0 48 48" className="h-9 w-9 text-[#EF0101]" fill="currentColor">
            <path d="M24 4l3.2 9.8H37l-8 5.8 3.1 9.6L24 23.4 15.9 29.2l3.1-9.6-8-5.8h9.8L24 4z" />
            <circle cx="10" cy="38" r="3" opacity="0.55" />
            <circle cx="38" cy="36" r="2.5" opacity="0.55" />
            <circle cx="24" cy="42" r="2" opacity="0.4" />
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A7460]">
          Push to Production
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-heading,Georgia,serif)] text-3xl font-bold text-[#32261C]">
          Congratulations!
        </h2>
        <p className="mt-3 text-base text-[#5C4A3A]">
          <span className="font-semibold text-[#32261C]">{name}</span>
          {' '}completed the final milestone
          {lead ? (
            <>
              {' '}for <span className="font-semibold text-[#32261C]">{lead}</span>
            </>
          ) : null}
          .
        </p>
        <p className="mt-2 text-sm text-[#8A7460]">
          Project is ready to push to production. Great work!
        </p>
        <button
          type="button"
          onClick={close}
          className="mt-7 rounded-lg bg-[#EF0101] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#d40000]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
