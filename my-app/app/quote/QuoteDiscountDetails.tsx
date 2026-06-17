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

  const totalBefore = granularRows.reduce((sum, row) => sum + (row.price ?? 0), 0);
  const totalAfter = granularRows.reduce((sum, row) => sum + (row.discountedPrice ?? row.price ?? 0), 0);

  return (
    <div className="border-t border-gray-100 pt-3 space-y-2">
      <p className="text-sm font-semibold text-gray-800">Discount Details</p>

      {granularRows.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Granular discount</p>

          <div className="hidden grid-cols-12 gap-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:grid">
            <div className="col-span-3">Category</div>
            <div className="col-span-3 text-right">Before</div>
            <div className="col-span-3 text-right">After</div>
            <div className="col-span-3 text-right">Discount</div>
          </div>

          {granularRows.map((row) => (
            <div key={row.key} className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center sm:gap-2">
                <span className="font-medium text-gray-800 sm:col-span-3">{row.label}</span>
                <div className="flex items-center justify-between gap-3 sm:col-span-3 sm:justify-end">
                  <span className="text-xs text-gray-500 sm:hidden">Before</span>
                  <span className="tabular-nums text-gray-500 line-through">{formatCurrency(row.price)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 sm:col-span-3 sm:justify-end">
                  <span className="text-xs text-gray-500 sm:hidden">After</span>
                  <span className="font-semibold tabular-nums text-gray-900">
                    {formatCurrency(row.discountedPrice ?? row.price)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 sm:col-span-3 sm:justify-end">
                  <span className="text-xs text-gray-500 sm:hidden">Discount</span>
                  <span className="tabular-nums text-emerald-700">
                    {row.discountPct != null && row.discountPct > 0 ? `${row.discountPct}%` : '0%'}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-between border-t border-gray-200 px-3 pt-2 text-sm">
            <span className="font-medium text-gray-700">Category total</span>
            <div className="flex items-center gap-4 tabular-nums">
              <span className="text-gray-500 line-through">{formatCurrency(totalBefore)}</span>
              <span className="font-semibold text-gray-900">{formatCurrency(totalAfter)}</span>
            </div>
          </div>
        </div>
      ) : null}

      {extraRows.map((row) => (
        <div key={row.key} className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-800">{row.label}</span>
            <div className="flex items-center gap-3 tabular-nums">
              {row.price != null ? (
                <span className="text-gray-500 line-through">{formatCurrency(row.price)}</span>
              ) : null}
              <span className="font-semibold text-gray-900">
                {formatCurrency(row.discountedPrice ?? row.price)}
              </span>
            </div>
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
