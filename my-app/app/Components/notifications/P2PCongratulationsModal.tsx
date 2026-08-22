'use client';

type Props = {
  open: boolean;
  designerName: string;
  leadName?: string;
  onClose: () => void;
};

const BALLOONS = ['🎈', '🎉', '🎊', '🎈', '✨', '🎈', '🎉', '🎊'];

export default function P2PCongratulationsModal({ open, designerName, leadName, onClose }: Props) {
  if (!open) return null;
  const who = designerName || 'Designer';
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {BALLOONS.map((emoji, i) => (
          <span
            key={`${emoji}-${i}`}
            className="absolute animate-bounce text-3xl"
            style={{
              left: `${8 + i * 12}%`,
              top: `${10 + (i % 4) * 18}%`,
              animationDelay: `${i * 0.12}s`,
              animationDuration: `${1.4 + (i % 3) * 0.3}s`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <p className="text-5xl">🏆</p>
        <h2 className="mt-4 text-2xl font-bold text-[#32261C]">Congratulations!</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {who} successfully completed this lead
          {leadName ? (
            <>
              {' '}
              <span className="font-semibold text-[#32261C]">{leadName}</span>
            </>
          ) : null}
          . Push to production is done.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-lg bg-[#EF0101] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#d40101]"
        >
          Awesome
        </button>
      </div>
    </div>
  );
}
