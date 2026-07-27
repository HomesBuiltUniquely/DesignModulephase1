'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — refunds live at /finance/refunds */
export default function SalesClosureFinanceRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/finance/refunds');
  }, [router]);
  return (
    <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
      <p className="text-white text-sm">Redirecting to Refunds…</p>
    </div>
  );
}
