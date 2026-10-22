'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '../auth/AuthContext';
import { DesignNotificationProvider } from '../Components/DesignNotificationProvider';
import BookingCelebrationHost from '../Components/BookingCelebrationHost';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DesignNotificationProvider>
        {children}
        <BookingCelebrationHost />
      </DesignNotificationProvider>
    </AuthProvider>
  );
}
 