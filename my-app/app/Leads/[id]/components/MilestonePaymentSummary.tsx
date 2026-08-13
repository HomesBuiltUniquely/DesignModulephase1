'use client';

type QuotePaymentSummary = {
  quoteId: number | null;
  quoteNum: string | null;
  totalPayableAmount: number;
  tenPercentAmount: number;
  twentyPercentTarget: number;
  sixtyPercentTarget: number;
  fortyPercentAmount: number;
  totalPaidCumulative: number;
  totalPaidToward10Percent: number;
  totalPaidToward40Percent: number;
  previousTenPercentTarget: number | null;
  previousTwentyPercentTarget: number | null;
  previousSixtyPercentTarget: number | null;
  previousFortyPercentTarget: number | null;
  quotationTotalAtLastPayment: number | null;
  amountToCollect10: number;
  amountToCollect40: number;
  quoteRevisionTopUp10: number;
  quoteRevisionTopUp40: number;
  remainingAfterTwentyPercent: number;
  remainingAfterSixtyPercent: number;
};

type Props = {
  variant: '10' | '40';
  summary: QuotePaymentSummary | null;
  loading?: boolean;
  error?: string | null;
};

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export default function MilestonePaymentSummary({ variant, summary, loading, error }: Props) {
  if (loading) {
    return (
      <div className="mb-3 flex-shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Payment summary</p>
        <p className="mt-1 text-xs text-gray-400">Loading latest quotation…</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="mb-3 flex-shrink-0 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">Payment summary</p>
        <p className="mt-1 text-xs text-amber-800">
          {error || 'No quotation found yet. Generate a quote in Prolance first.'}
        </p>
      </div>
    );
  }

  const isTen = variant === '10';
  const cumulativeTarget = isTen ? summary.twentyPercentTarget : summary.sixtyPercentTarget;
  const cumulativePctLabel = isTen ? '20%' : '60%';
  const alreadyPaid = summary.totalPaidCumulative;
  const amountToCollect = isTen ? summary.amountToCollect10 : summary.amountToCollect40;
  const quoteRevisionTopUp = isTen ? summary.quoteRevisionTopUp10 : summary.quoteRevisionTopUp40;
  const previousTarget = isTen
    ? summary.previousTwentyPercentTarget
    : summary.previousSixtyPercentTarget ?? summary.previousFortyPercentTarget;
  const remainingBalance = isTen
    ? summary.remainingAfterTwentyPercent
    : summary.remainingAfterSixtyPercent;
  const quoteRevised =
    quoteRevisionTopUp > 0 &&
    summary.quotationTotalAtLastPayment != null &&
    summary.quotationTotalAtLastPayment < summary.totalPayableAmount;

  const rows: { label: string; value: string; highlight?: boolean; muted?: boolean }[] = [
    { label: 'Total Quotation Value (latest)', value: formatInr(summary.totalPayableAmount) },
    {
      label: isTen
        ? '20% Cumulative Target (Sales 10% + Design 10%)'
        : '60% Cumulative Target',
      value: formatInr(cumulativeTarget),
    },
  ];

  if (quoteRevised && previousTarget != null && previousTarget > 0) {
    rows.push({
      label: `Previous ${cumulativePctLabel} target (old quote)`,
      value: formatInr(previousTarget),
      muted: true,
    });
    rows.push({
      label: 'Top-up (quote revised)',
      value: `+${formatInr(quoteRevisionTopUp)}`,
      muted: true,
    });
  }

  if (alreadyPaid > 0) {
    rows.push({
      label: 'Already Paid (sales / prior)',
      value: formatInr(alreadyPaid),
    });
  }

  rows.push({
    label: 'Amount to Collect Now',
    value: formatInr(amountToCollect),
    highlight: true,
  });

  rows.push({
    label: 'Remaining Project Balance',
    value: formatInr(remainingBalance),
  });

  const fullyCollected = amountToCollect <= 0;

  return (
    <div className="mb-3 flex-shrink-0 rounded-xl border border-[#DDCDC1] bg-white px-3 py-2.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#32261C]">Payment summary</p>
        {summary.quoteNum ? (
          <span className="text-[10px] font-bold text-[#EF0101]">{summary.quoteNum}</span>
        ) : summary.quoteId ? (
          <span className="text-[10px] font-bold text-[#EF0101]">Quote #{summary.quoteId}</span>
        ) : null}
      </div>
      {isTen && (
        <p className="mb-2 text-[10px] leading-snug text-[#32261C] bg-[#DDCDC1]/20 border border-[#DDCDC1] rounded px-2 py-1">
          Sales collected 10% at closure. Design module 10% payment brings the customer to 20% of the latest
          quotation.
        </p>
      )}
      {!isTen && (
        <p className="mb-2 text-[10px] leading-snug text-[#32261C] bg-[#DDCDC1]/20 border border-[#DDCDC1] rounded px-2 py-1">
          Design module 40% payment brings the customer to 60% cumulative of the latest quotation.
        </p>
      )}
      {quoteRevised && (
        <p className="mb-2 text-[10px] leading-snug text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1">
          Quotation revised since last payment — collect the updated amount to reach {cumulativePctLabel} of the
          latest quote.
        </p>
      )}
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
            <span className={row.muted ? 'text-gray-500' : 'text-gray-600'}>{row.label}</span>
            <span
              className={`font-semibold tabular-nums ${
                row.highlight ? 'text-[#32261C] text-sm' : row.muted ? 'text-gray-500' : 'text-gray-900'
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
      {fullyCollected && (
        <p className="mt-2 text-[10px] font-medium text-[#32261C]">
          {cumulativePctLabel} cumulative target is already met from prior payments.
        </p>
      )}
    </div>
  );
}

export type { QuotePaymentSummary };
