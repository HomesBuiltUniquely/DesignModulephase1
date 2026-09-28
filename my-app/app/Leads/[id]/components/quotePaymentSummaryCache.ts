import type { QuotePaymentSummary } from './MilestonePaymentSummary';

type CacheEntry = {
  leadId: number;
  summary: QuotePaymentSummary;
  at: number;
};

/** Short-lived in-memory cache so popup reuses tracker success when Prolance is flaky. */
let cache: CacheEntry | null = null;

const TTL_MS = 10 * 60 * 1000;

export function setCachedQuotePaymentSummary(leadId: number, summary: QuotePaymentSummary): void {
  if (!Number.isFinite(leadId) || leadId < 1) return;
  if (!(summary.totalPayableAmount > 0)) return;
  cache = { leadId, summary, at: Date.now() };
}

export function getCachedQuotePaymentSummary(leadId: number): QuotePaymentSummary | null {
  if (!cache || cache.leadId !== leadId) return null;
  if (Date.now() - cache.at > TTL_MS) {
    cache = null;
    return null;
  }
  return cache.summary;
}

export function clearCachedQuotePaymentSummary(leadId?: number): void {
  if (leadId == null || (cache && cache.leadId === leadId)) {
    cache = null;
  }
}
