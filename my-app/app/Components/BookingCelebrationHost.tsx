'use client';

import { useAuth } from '@/app/auth/AuthContext';
import BookingCelebration from './BookingCelebration';

function hallwayBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000';
  }
  const configured = process.env.NEXT_PUBLIC_HALLWAY_URL?.trim();
  return (configured || 'https://hallway-liart.vercel.app').replace(/\/$/, '');
}

/** Corner celebration for people already signed into Design. */
export default function BookingCelebrationHost() {
  const { user } = useAuth();
  if (!user) return null;
  const viewerKey = (user.email || String(user.id) || user.name || '').trim();
  if (!viewerKey) return null;
  return (
    <BookingCelebration
      apiBase={hallwayBase()}
      placement="corner"
      viewerKey={viewerKey}
      viewerName={user.name || viewerKey}
    />
  );
}
