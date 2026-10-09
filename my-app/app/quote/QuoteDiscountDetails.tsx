'use client';

import { useEffect, useMemo, useState } from 'react';
import type { QuoteDiscountBreakdownRow } from './quoteDiscountBreakdown';
import {
  clampDiscountPctForCategory,
  maxDiscountPctForCategory,
} from './quoteDiscountLimits';
import { inrFull, QUOTE } from './quoteStyles';

/** Designer woodwork limit; higher-authority roles can override it. */
const WOODWORK_SOFT_MAX = 40;
/** Designer additional flat discount cap as a % of total payable amount. */
const ADDITIONAL_DISCOUNT_MAX_PCT = 3;

export type QuoteCategoryDiscountSavePayload = {
  categoryPct: {
    woodwork: number;
    accessories: number;
    constructionHw: number;
    services: number;
  };
  /** Sum of category % discounts (rupees). */
  amount: number;
  /** Extra flat discount in rupees (not %). */
  additionalDiscount: number;
};

type Props = {
  rows: QuoteDiscountBreakdownRow[];
  totalDiscount: number | null;
  /** Saved additional flat discount in rupees (from quote snapshot). */
  additionalDiscount?: number | null;
  /** Total payable amount used to cap designer additional discount at 3%. */
  totalPayableAmount?: number | null;
  /** When set, designers can edit per-category % (woodwork ≤40%, others ≤5%). */
  editable?: boolean;
  /** Removes designer discount caps for Design Managers, TDMs, and Admins. */
  unrestrictedDiscounts?: boolean;
  saving?: boolean;
  saveError?: string | null;
  onSave?: (payload: QuoteCategoryDiscountSavePayload) => void | Promise<void>;
};

const EDITABLE_KEYS = ['woodwork', 'accessories', 'services'] as const;

function pctFromRows(
  rows: QuoteDiscountBreakdownRow[],
  unrestricted = false,
): Record<(typeof EDITABLE_KEYS)[number], number> {
  const out = {
    woodwork: 0,
    accessories: 0,
    services: 0,
    constructionHw: 0,
  };
  for (const key of EDITABLE_KEYS) {
    const row = rows.find((r) => r.key === key);
    out[key] = clampDiscountPctForCategory(key, row?.discountPct ?? 0, unrestricted);
  }
  return out;
}

function clampRupeeAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function additionalFromRows(rows: QuoteDiscountBreakdownRow[], fallback: number | null | undefined): number {
  const row = rows.find((r) => r.key === 'additionalDiscount');
  if (row?.discountAmount != null) return clampRupeeAmount(row.discountAmount);
  return clampRupeeAmount(fallback ?? 0);
}

function previewRow(
  row: QuoteDiscountBreakdownRow,
  draftPct: number,
  unrestricted = false,
): { discountedPrice: number; discountAmount: number; discountPct: number } {
  const price = row.price ?? 0;
  const pct = clampDiscountPctForCategory(row.key, draftPct, unrestricted);
  const discountAmount = price > 0 && pct > 0 ? Math.round((price * pct) / 100) : 0;
  return {
    discountPct: pct,
    discountAmount,
    discountedPrice: Math.max(0, price - discountAmount),
  };
}

export function QuoteDiscountDetails({
  rows,
  totalDiscount,
  additionalDiscount = null,
  totalPayableAmount = null,
  editable = false,
  unrestrictedDiscounts = false,
  saving = false,
  saveError = null,
  onSave,
}: Props) {
  const [draftPct, setDraftPct] = useState(() => pctFromRows(rows, unrestrictedDiscounts));
  const [draftAdditional, setDraftAdditional] = useState(() =>
    additionalFromRows(rows, additionalDiscount),
  );
  const [dirty, setDirty] = useState(false);
  const [woodworkPopup, setWoodworkPopup] = useState<number | null>(null);
  const [additionalPopup, setAdditionalPopup] = useState<number | null>(null);

  useEffect(() => {
    if (!dirty) {
      setDraftPct(pctFromRows(rows, unrestrictedDiscounts));
      setDraftAdditional(additionalFromRows(rows, additionalDiscount));
    }
  }, [rows, additionalDiscount, dirty, unrestrictedDiscounts]);

  const granularRows = rows.filter((r) => r.alwaysShow);
  const extraRows = rows.filter(
    (r) => !r.alwaysShow && r.key !== 'additionalDiscount',
  );
  const savedAdditionalRow = rows.find((r) => r.key === 'additionalDiscount');

  const categoryTotal = useMemo(() => {
    return EDITABLE_KEYS.reduce((sum, key) => {
      const row = rows.find((r) => r.key === key);
      if (!row) return sum;
      if (editable) return sum + previewRow(row, draftPct[key], unrestrictedDiscounts).discountAmount;
      return sum + (row.discountAmount ?? 0);
    }, 0);
  }, [editable, rows, draftPct, unrestrictedDiscounts]);

  const previewTotal = useMemo(() => {
    if (!editable) return totalDiscount ?? categoryTotal + (savedAdditionalRow?.discountAmount ?? 0);
    return categoryTotal + draftAdditional;
  }, [editable, totalDiscount, categoryTotal, draftAdditional, savedAdditionalRow]);

  if (!rows.length && totalDiscount == null && !(additionalDiscount != null && additionalDiscount > 0)) {
    return null;
  }

  const handlePctChange = (key: (typeof EDITABLE_KEYS)[number], raw: string) => {
    const n = Number(raw);
    const val = Number.isFinite(n) ? n : 0;
    if (!unrestrictedDiscounts && key === 'woodwork' && val > WOODWORK_SOFT_MAX) {
      // Show popup but do NOT clamp — let user see the warning; don't apply the value
      setWoodworkPopup(val);
      return;
    }
    setDraftPct((prev) => ({
      ...prev,
      [key]: clampDiscountPctForCategory(key, val, unrestrictedDiscounts),
    }));
    setDirty(true);
  };

  const handleAdditionalChange = (raw: string) => {
    const val = clampRupeeAmount(raw === '' ? 0 : Number(raw));
    const maxAllowed =
      totalPayableAmount != null && totalPayableAmount > 0
        ? Math.floor((totalPayableAmount * ADDITIONAL_DISCOUNT_MAX_PCT) / 100)
        : null;
    if (!unrestrictedDiscounts && maxAllowed != null && val > maxAllowed) {
      setAdditionalPopup(val);
      return;
    }
    setDraftAdditional(val);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!onSave) return;
    const amount = EDITABLE_KEYS.reduce((sum, key) => {
      const row = rows.find((r) => r.key === key);
      if (!row) return sum;
      return sum + previewRow(row, draftPct[key], unrestrictedDiscounts).discountAmount;
    }, 0);
    await onSave({
      categoryPct: {
        woodwork: draftPct.woodwork,
        accessories: draftPct.accessories,
        constructionHw: 0,
        services: draftPct.services,
      },
      amount,
      additionalDiscount: draftAdditional,
    });
    setDirty(false);
  };

  const showAdditionalReadOnly =
    !editable && (savedAdditionalRow?.discountAmount ?? additionalDiscount ?? 0) > 0;

  return (
    <>
      {/* Woodwork > 40% popup */}
      {!unrestrictedDiscounts && woodworkPopup !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#ece6df] bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: QUOTE.red }}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </span>
              <h3 className="font-bold text-[#2a1d14]">High Discount Alert</h3>
            </div>
            <p className="text-sm text-[#5c5650]">
              Contact your higher authority for a{' '}
              <span className="font-bold text-[#c1272d]">{woodworkPopup}%</span> woodwork discount.
              Maximum allowed without approval is {WOODWORK_SOFT_MAX}%.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setWoodworkPopup(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: QUOTE.brown }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Additional discount > 3% popup */}
      {!unrestrictedDiscounts && additionalPopup !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#ece6df] bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: QUOTE.red }}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </span>
              <h3 className="font-bold text-[#2a1d14]">Additional Discount Limit</h3>
            </div>
            <p className="text-sm text-[#5c5650]">
              Contact your higher authority for an additional discount of{' '}
              <span className="font-bold text-[#c1272d]">{inrFull(additionalPopup)}</span>.
              Maximum additional discount is {ADDITIONAL_DISCOUNT_MAX_PCT}% of total payable amount.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setAdditionalPopup(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: QUOTE.brown }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3 border-t border-[#ece6df] pt-4">
        {granularRows.length > 0 ? (
          <div className="space-y-2">
            {/* Task 1: removed the "Woodwork max X% · Others max Y%" hint text */}
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: QUOTE.muted }}>
                Discount breakdown
              </p>
            </div>
            {granularRows.map((row) => {
              const isEditKey = EDITABLE_KEYS.includes(row.key as (typeof EDITABLE_KEYS)[number]);
              const isConstructionHw = row.key === 'constructionHw';
              const canEdit = editable && isEditKey;
              const draft = isConstructionHw
                ? 0
                : isEditKey
                ? draftPct[row.key as (typeof EDITABLE_KEYS)[number]]
                : row.discountPct ?? 0;
              const preview = canEdit ? previewRow(row, draft, unrestrictedDiscounts) : null;
              const showPct = isConstructionHw ? 0 : preview?.discountPct ?? row.discountPct ?? 0;
              const showDiscounted = isConstructionHw
                ? row.price ?? row.discountedPrice
                : preview?.discountedPrice ?? row.discountedPrice ?? row.price;
              const original = row.price;
              const showOriginal =
                original != null &&
                original > 0 &&
                showDiscounted != null &&
                original !== showDiscounted;

              return (
                <div
                  key={row.key}
                  className="min-w-0 rounded-lg border border-[#ece6df] bg-[#faf8f5] px-3 py-3 text-sm sm:px-4"
                >
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="shrink-0 font-semibold text-[#2a1d14]">{row.label}</span>
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums sm:justify-end">
                      {showOriginal ? (
                        <span className="shrink-0 text-[#9a928c] line-through">{inrFull(original)}</span>
                      ) : null}
                      <span className="shrink-0 font-bold text-[#2a1d14]">{inrFull(showDiscounted)}</span>
                      {canEdit ? (
                        <label className="flex shrink-0 items-center gap-1 font-semibold" style={{ color: QUOTE.red }}>
                          <input
                            type="number"
                            min={0}
                            max={maxDiscountPctForCategory(row.key, unrestrictedDiscounts)}
                            step={0.1}
                            value={draft}
                            disabled={saving}
                            onChange={(e) =>
                              handlePctChange(row.key as (typeof EDITABLE_KEYS)[number], e.target.value)
                            }
                            className="w-16 rounded border border-[#e5ddd4] bg-white px-2 py-1 text-right text-sm font-semibold text-[#c1272d] outline-none focus:border-[#c1272d]"
                            aria-label={`${row.label} discount percent`}
                          />
                          <span>%</span>
                        </label>
                      ) : isConstructionHw ? (
                        <span className="shrink-0 font-semibold" style={{ color: QUOTE.red }}>
                          0%
                        </span>
                      ) : (
                        <span className="shrink-0 font-semibold" style={{ color: QUOTE.red }}>
                          {showPct > 0 ? `${showPct}%` : '0%'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {extraRows.map((row) => (
          <div
            key={row.key}
            className="flex min-w-0 flex-col gap-1 rounded-lg border border-[#ece6df] bg-[#faf8f5] px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-4"
          >
            <span className="font-medium text-[#2a1d14]">{row.label}</span>
            <span className="font-semibold tabular-nums text-[#2a1d14]">
              {inrFull(row.discountedPrice ?? row.price)}
            </span>
          </div>
        ))}

        {editable || showAdditionalReadOnly ? (
          <div className="rounded-lg border border-[#ece6df] bg-[#faf8f5] px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-[#2a1d14]">Additional Discount</span>
                {editable ? (
                  <p className="text-[11px]" style={{ color: QUOTE.muted }}>
                    Flat amount in ₹ (not %)
                  </p>
                ) : null}
              </div>
              {editable ? (
                <label className="flex items-center gap-1 font-semibold tabular-nums" style={{ color: QUOTE.red }}>
                  <span>₹</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draftAdditional}
                    disabled={saving}
                    onChange={(e) => handleAdditionalChange(e.target.value)}
                    className="w-28 rounded border border-[#e5ddd4] bg-white px-2 py-1 text-right text-sm font-semibold text-[#c1272d] outline-none focus:border-[#c1272d]"
                    aria-label="Additional discount in rupees"
                  />
                </label>
              ) : (
                <span className="font-semibold tabular-nums" style={{ color: QUOTE.red }}>
                  - {inrFull(savedAdditionalRow?.discountAmount ?? additionalDiscount ?? 0)}
                </span>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex justify-between text-sm">
          <span style={{ color: QUOTE.muted }}>Discount</span>
          <span className="font-semibold tabular-nums" style={{ color: QUOTE.red }}>
            {previewTotal > 0 ? `- ${inrFull(previewTotal)}` : inrFull(0)}
          </span>
        </div>

        {editable && onSave ? (
          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            {saveError ? <p className="text-xs text-[#c1272d]">{saveError}</p> : null}
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => void handleSave()}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: QUOTE.brown }}
            >
              {saving ? 'Saving…' : 'Save discount'}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
