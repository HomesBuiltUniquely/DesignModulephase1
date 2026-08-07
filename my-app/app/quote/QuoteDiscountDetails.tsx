'use client';

import { useEffect, useMemo, useState } from 'react';
import type { QuoteDiscountBreakdownRow } from './quoteDiscountBreakdown';
import {
  clampDiscountPctForCategory,
  maxDiscountPctForCategory,
  OTHER_CATEGORY_MAX_DISCOUNT_PCT,
  WOODWORK_MAX_DISCOUNT_PCT,
} from './quoteDiscountLimits';
import { inrFull, QUOTE } from './quoteStyles';

export type QuoteCategoryDiscountSavePayload = {
  categoryPct: {
    woodwork: number;
    accessories: number;
    constructionHw: number;
    services: number;
  };
  amount: number;
};

type Props = {
  rows: QuoteDiscountBreakdownRow[];
  totalDiscount: number | null;
  /** When set, designers can edit per-category % (woodwork ≤35%, others ≤5%). */
  editable?: boolean;
  saving?: boolean;
  saveError?: string | null;
  onSave?: (payload: QuoteCategoryDiscountSavePayload) => void | Promise<void>;
};

const EDITABLE_KEYS = ['woodwork', 'accessories', 'constructionHw', 'services'] as const;

function pctFromRows(rows: QuoteDiscountBreakdownRow[]): Record<(typeof EDITABLE_KEYS)[number], number> {
  const out = {
    woodwork: 0,
    accessories: 0,
    constructionHw: 0,
    services: 0,
  };
  for (const key of EDITABLE_KEYS) {
    const row = rows.find((r) => r.key === key);
    out[key] = clampDiscountPctForCategory(key, row?.discountPct ?? 0);
  }
  return out;
}

function previewRow(
  row: QuoteDiscountBreakdownRow,
  draftPct: number,
): { discountedPrice: number; discountAmount: number; discountPct: number } {
  const price = row.price ?? 0;
  const pct = clampDiscountPctForCategory(row.key, draftPct);
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
  editable = false,
  saving = false,
  saveError = null,
  onSave,
}: Props) {
  const [draftPct, setDraftPct] = useState(() => pctFromRows(rows));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setDraftPct(pctFromRows(rows));
  }, [rows, dirty]);

  const granularRows = rows.filter((r) => r.alwaysShow);
  const extraRows = rows.filter((r) => !r.alwaysShow);

  const previewTotal = useMemo(() => {
    if (!editable) return totalDiscount ?? 0;
    return EDITABLE_KEYS.reduce((sum, key) => {
      const row = rows.find((r) => r.key === key);
      if (!row) return sum;
      return sum + previewRow(row, draftPct[key]).discountAmount;
    }, 0);
  }, [editable, rows, draftPct, totalDiscount]);

  if (!rows.length && totalDiscount == null) return null;

  const handlePctChange = (key: (typeof EDITABLE_KEYS)[number], raw: string) => {
    const n = Number(raw);
    setDraftPct((prev) => ({
      ...prev,
      [key]: clampDiscountPctForCategory(key, Number.isFinite(n) ? n : 0),
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!onSave) return;
    const amount = EDITABLE_KEYS.reduce((sum, key) => {
      const row = rows.find((r) => r.key === key);
      if (!row) return sum;
      return sum + previewRow(row, draftPct[key]).discountAmount;
    }, 0);
    await onSave({
      categoryPct: {
        woodwork: draftPct.woodwork,
        accessories: draftPct.accessories,
        constructionHw: draftPct.constructionHw,
        services: draftPct.services,
      },
      amount,
    });
    setDirty(false);
  };

  return (
    <div className="space-y-3 border-t border-[#ece6df] pt-4">
      {granularRows.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: QUOTE.muted }}>
              Discount breakdown
            </p>
            {editable ? (
              <p className="text-[11px]" style={{ color: QUOTE.muted }}>
                Woodwork max {WOODWORK_MAX_DISCOUNT_PCT}% · Others max {OTHER_CATEGORY_MAX_DISCOUNT_PCT}%
              </p>
            ) : null}
          </div>
          {granularRows.map((row) => {
            const isEditKey = EDITABLE_KEYS.includes(row.key as (typeof EDITABLE_KEYS)[number]);
            const draft = isEditKey
              ? draftPct[row.key as (typeof EDITABLE_KEYS)[number]]
              : row.discountPct ?? 0;
            const preview = editable && isEditKey ? previewRow(row, draft) : null;
            const showPct = preview?.discountPct ?? row.discountPct ?? 0;
            const showDiscounted = preview?.discountedPrice ?? row.discountedPrice ?? row.price;

            return (
              <div
                key={row.key}
                className="rounded-lg border border-[#ece6df] bg-[#faf8f5] px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#2a1d14]">{row.label}</span>
                  <div className="flex flex-wrap items-center gap-4 tabular-nums">
                    <span className="text-[#9a928c] line-through">{inrFull(row.price)}</span>
                    <span className="font-bold text-[#2a1d14]">{inrFull(showDiscounted)}</span>
                    {editable && isEditKey ? (
                      <label className="flex items-center gap-1 font-semibold" style={{ color: QUOTE.red }}>
                        <input
                          type="number"
                          min={0}
                          max={maxDiscountPctForCategory(row.key)}
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
                    ) : (
                      <span className="font-semibold" style={{ color: QUOTE.red }}>
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
        <div key={row.key} className="flex justify-between rounded-lg border border-[#ece6df] bg-[#faf8f5] px-4 py-3 text-sm">
          <span className="font-medium text-[#2a1d14]">{row.label}</span>
          <span className="font-semibold tabular-nums text-[#2a1d14]">
            {inrFull(row.discountedPrice ?? row.price)}
          </span>
        </div>
      ))}

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
  );
}
