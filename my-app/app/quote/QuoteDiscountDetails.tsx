'use client';

import type { QuoteDiscountBreakdownRow } from './quoteDiscountBreakdown';
import { inrFull, QUOTE } from './quoteStyles';

type Props = {
  rows: QuoteDiscountBreakdownRow[];
  totalDiscount: number | null;
};

export function QuoteDiscountDetails({ rows, totalDiscount }: Props) {
  if (!rows.length && totalDiscount == null) return null;

  const granularRows = rows.filter((r) => r.alwaysShow);
  const extraRows = rows.filter((r) => !r.alwaysShow);

  return (
    <div className="space-y-3 border-t border-[#ece6df] pt-4">
      {granularRows.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: QUOTE.muted }}>
            Discount breakdown
          </p>
          {granularRows.map((row) => (
            <div
              key={row.key}
              className="rounded-lg border border-[#ece6df] bg-[#faf8f5] px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[#2a1d14]">{row.label}</span>
                <div className="flex flex-wrap items-center gap-4 tabular-nums">
                  <span className="text-[#9a928c] line-through">{inrFull(row.price)}</span>
                  <span className="font-bold text-[#2a1d14]">
                    {inrFull(row.discountedPrice ?? row.price)}
                  </span>
                  <span className="font-semibold" style={{ color: QUOTE.red }}>
                    {row.discountPct != null && row.discountPct > 0 ? `${row.discountPct}%` : '0%'}
                  </span>
                </div>
              </div>
            </div>
          ))}
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
          {totalDiscount != null && totalDiscount > 0 ? `- ${inrFull(totalDiscount)}` : inrFull(0)}
        </span>
      </div>
    </div>
  );
}
