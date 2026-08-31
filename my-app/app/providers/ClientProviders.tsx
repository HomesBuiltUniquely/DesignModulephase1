'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '../auth/AuthContext';
import { DesignNotificationProvider } from '../Components/DesignNotificationProvider';
import P2pCelebrationOverlay from '../Components/P2pCelebrationOverlay';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DesignNotificationProvider>
        {children}
        <P2pCelebrationOverlay />
      </DesignNotificationProvider>
    </AuthProvider>
  );
}
