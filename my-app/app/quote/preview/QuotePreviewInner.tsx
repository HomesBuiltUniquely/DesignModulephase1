'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuoteExperience } from '@/app/quote/QuoteExperience';
import { coerceQuoteBodyForPreview } from '@/app/lib/prolanceApiGetQuote';
import {
  clearPostGetQuotePreview,
  readPostGetQuotePreviewRaw,
} from '@/app/lib/prolanceGetQuotePersistSnapshot';

/**
 * Full quotation page for Pre‑10% when Get quote returns a body but no persisted quote id yet.
 */
export function QuotePreviewInner() {
  const searchParams = useSearchParams();
  const leadIdRaw = searchParams.get('leadId');
  const leadId = leadIdRaw != null && leadIdRaw !== '' ? Number(leadIdRaw) : NaN;

  const [payload, setPayload] = useState<Record<string, unknown> | null | undefined>(undefined);

  useEffect(() => {
    if (!Number.isFinite(leadId) || leadId < 1) {
      setPayload(null);
      return;
    }
    try {
      const raw = readPostGetQuotePreviewRaw();
      if (!raw) {
        setPayload(null);
        return;
      }
      const parsed = JSON.parse(raw) as { leadId?: unknown; quoteBody?: unknown };
      const storedLeadId = parsed.leadId != null ? Number(parsed.leadId) : NaN;
      if (!Number.isFinite(storedLeadId) || storedLeadId !== leadId) {
        setPayload(null);
        return;
      }
      let p = coerceQuoteBodyForPreview(parsed.quoteBody);
      if (p == null && parsed.quoteBody != null && typeof parsed.quoteBody === 'object') {
        if (!Array.isArray(parsed.quoteBody)) {
          p = parsed.quoteBody as Record<string, unknown>;
        } else if (
          Array.isArray(parsed.quoteBody) &&
          parsed.quoteBody[0] &&
          typeof parsed.quoteBody[0] === 'object'
        ) {
          p = parsed.quoteBody[0] as Record<string, unknown>;
        }
      }
      if (p == null) {
        setPayload(null);
        return;
      }
      clearPostGetQuotePreview();
      setPayload(p);
    } catch {
      setPayload(null);
    }
  }, [leadId]);

  if (payload === undefined) {
    return <div className="min-h-screen bg-[#f5f5f8] p-6 text-gray-700">Loading quotation…</div>;
  }
  if (payload === null) {
    return (
      <div className="min-h-screen bg-[#f5f5f8] p-6 text-rose-700">
        Quotation preview is missing or expired. Run <strong>Get quote</strong> again from the dashboard.
      </div>
    );
  }

  return <QuoteExperience quoteId="" preloadedPayload={payload} />;
}
