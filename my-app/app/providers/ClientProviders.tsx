'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '../auth/AuthContext';
import { DesignNotificationProvider } from '../Components/DesignNotificationProvider';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DesignNotificationProvider>{children}</DesignNotificationProvider>
    </AuthProvider>
  );
}
