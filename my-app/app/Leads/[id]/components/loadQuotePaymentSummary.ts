import { getApiBase } from '@/app/lib/apiBase';
import {
  getCachedQuotePaymentSummary,
  setCachedQuotePaymentSummary,
} from './quotePaymentSummaryCache';
import { parseQuotePaymentSummaryResponse } from './mapQuotePaymentSummary';
import type { QuotePaymentSummary } from './MilestonePaymentSummary';

type LoadResult = {
  summary: QuotePaymentSummary | null;
  message: string | null;
};

/**
 * Load quote payment summary with cache + retries.
 * Prolance-backed production API is flaky; tracker and popup share this helper
 * so a successful card load is reused when the collection popup opens.
 */
export async function loadQuotePaymentSummary(options: {
  leadId: number;
  apiBase?: string | null;
  signal?: AbortSignal;
  /** Extra attempts after the first (default 2 → 3 total). */
  retries?: number;
}): Promise<LoadResult> {
  const { leadId, signal } = options;
  const retries = options.retries ?? 2;
  const base = (options.apiBase || getApiBase()).replace(/\/$/, '');
  const url = `${base}/api/sales-closure/lead/${encodeURIComponent(String(leadId))}/quote-payment-summary`;

  const cached = getCachedQuotePaymentSummary(leadId);
  let lastMessage: string | null =
    'No quotation found yet. Generate a quote in Prolance first.';

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      return { summary: cached, message: cached ? null : lastMessage };
    }
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
      if (signal?.aborted) {
        return { summary: cached, message: cached ? null : lastMessage };
      }
    }

    try {
      const res = await fetch(url, { cache: 'no-store', signal });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        lastMessage =
          typeof body.message === 'string' ? body.message : 'Could not load quotation totals';
        continue;
      }
      const parsed = parseQuotePaymentSummaryResponse(body);
      if (parsed.summary) {
        setCachedQuotePaymentSummary(leadId, parsed.summary);
        return { summary: parsed.summary, message: null };
      }
      lastMessage = parsed.message || lastMessage;
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        return { summary: cached, message: cached ? null : lastMessage };
      }
      lastMessage = 'Could not load quotation totals';
    }
  }

  // Prefer a recent successful tracker load over showing amber empty state.
  if (cached) {
    return { summary: cached, message: null };
  }
  return { summary: null, message: lastMessage };
}
