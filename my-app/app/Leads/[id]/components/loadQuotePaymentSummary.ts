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
  /** True when response came from in-memory cache (instant paint). */
  fromCache?: boolean;
};

/**
 * Load quote payment summary with cache + light retries.
 * Prefer cache for instant UI; refresh in background via callers.
 * Backend falls back to design_payment_case_summary when Prolance is down.
 */
export async function loadQuotePaymentSummary(options: {
  leadId: number;
  apiBase?: string | null;
  signal?: AbortSignal;
  /** Extra attempts after the first (default 1 → 2 total). */
  retries?: number;
  /** If true, return cache immediately when present (caller can refresh again). */
  preferCache?: boolean;
}): Promise<LoadResult> {
  const { leadId, signal } = options;
  const retries = options.retries ?? 1;
  const base = (options.apiBase || getApiBase()).replace(/\/$/, '');
  const url = `${base}/api/sales-closure/lead/${encodeURIComponent(String(leadId))}/quote-payment-summary`;

  const cached = getCachedQuotePaymentSummary(leadId);
  if (options.preferCache && cached) {
    return { summary: cached, message: null, fromCache: true };
  }

  let lastMessage: string | null =
    'No quotation found yet. Generate a quote in Prolance first.';

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      return { summary: cached, message: cached ? null : lastMessage, fromCache: Boolean(cached) };
    }
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 250 * attempt));
      if (signal?.aborted) {
        return { summary: cached, message: cached ? null : lastMessage, fromCache: Boolean(cached) };
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
        return { summary: cached, message: cached ? null : lastMessage, fromCache: Boolean(cached) };
      }
      lastMessage = 'Could not load quotation totals';
    }
  }

  // Prefer a recent successful tracker load over showing amber empty state.
  if (cached) {
    return { summary: cached, message: null, fromCache: true };
  }
  return { summary: null, message: lastMessage };
}
