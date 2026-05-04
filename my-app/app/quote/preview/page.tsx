import { Suspense } from 'react';
import { QuotePreviewInner } from './QuotePreviewInner';

export default function QuotePreviewFromSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5f5f8] p-6 text-gray-700">Loading quotation…</div>
      }
    >
      <QuotePreviewInner />
    </Suspense>
  );
}
