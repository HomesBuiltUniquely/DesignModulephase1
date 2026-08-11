'use client';

import { useEffect, useState } from 'react';

type Mode = 'light' | 'dark';

export default function ThemeModeToggle({ className = '' }: { className?: string }) {
  const [mode, setMode] = useState<Mode>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('design-module-theme') : null) as Mode | null;
    const next: Mode = saved === 'dark' ? 'dark' : 'light';
    setMode(next);
    document.documentElement.setAttribute('data-theme', next);
    setReady(true);
  }, []);

  const toggle = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('design-module-theme', next);
  };

  if (!ready) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className={`rounded-md border border-[#00B0ED] px-3 py-1.5 text-xs font-semibold text-[#32261C] hover:bg-[#DDCDC1]/20 ${className}`}
      title="Toggle light/dark mode"
    >
      {mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
    </button>
  );
}

