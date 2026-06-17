'use client';

import type { QuoteDiscountBreakdownRow } from './quoteDiscountBreakdown';

function formatCurrency(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return '-';
}

type Props = {
  rows: QuoteDiscountBreakdownRow[];
  totalDiscount: number | null;
};

export function QuoteDiscountDetails({ rows, totalDiscount }: Props) {
  if (!rows.length && totalDiscount == null) return null;

  const granularRows = rows.filter((r) => r.alwaysShow);
  const extraRows = rows.filter((r) => !r.alwaysShow);

  return (
    <div className="border-t border-gray-100 pt-3 space-y-2">
      <p className="text-sm font-semibold text-gray-800">Discount Details</p>

      {granularRows.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Granular discount</p>
          {granularRows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2.5 text-sm"
            >
              <span className="font-medium text-gray-800">{row.label}</span>
              <div className="flex items-center gap-4 tabular-nums">
                <span className="font-semibold text-gray-900">{formatCurrency(row.price)}</span>
                <span className="min-w-[3rem] text-right text-gray-600">
                  {row.discountPct != null ? `${row.discountPct}%` : '0%'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {extraRows.map((row) => (
        <div key={row.key} className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-800">{row.label}</span>
            {row.price != null ? (
              <span className="font-semibold text-gray-900">{formatCurrency(row.price)}</span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-gray-600">
            {row.discountPct != null && row.discountPct > 0 ? (
              <span>Discount: {row.discountPct}%</span>
            ) : null}
            {row.factor != null ? <span>Factor: {row.factor}%</span> : null}
            {row.discountAmount != null && row.discountAmount > 0 ? (
              <span className="font-semibold text-emerald-700">
                Amount off: {formatCurrency(row.discountAmount)}
              </span>
            ) : null}
          </div>
        </div>
      ))}

      <div className="flex justify-between border-t border-gray-100 pt-2 text-sm">
        <span className="text-gray-600">Total Discount</span>
        <span className="font-semibold text-emerald-700">
          {totalDiscount != null && totalDiscount > 0 ? `- ${formatCurrency(totalDiscount)}` : '-'}
        </span>
      </div>
    </div>
  );
}
