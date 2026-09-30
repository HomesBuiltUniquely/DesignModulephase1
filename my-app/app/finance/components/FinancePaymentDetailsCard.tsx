'use client';

export type FinancePaymentDetail = {
  id: string;
  historyId?: number | null;
  attemptId?: string | null;
  leadId: number;
  bucket: string;
  amount: number;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  paymentMethod: string;
  paymentChannel: string;
  transactionId?: string | null;
  merchantTxn?: string | null;
  paidAt?: string | null;
  linkSentVia: string;
  linkSentBy: string;
  financeHandlingMode: string;
  source?: string;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatInr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

type Props = {
  payments: FinancePaymentDetail[];
  emptyHint?: string;
};

export default function FinancePaymentDetailsCard({ payments, emptyHint }: Props) {
  if (!payments.length) {
    return (
      <p className="text-sm text-gray-500">
        {emptyHint || 'No online payment details found for this lead yet.'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((p, idx) => (
        <div
          key={`${p.id}-${idx}`}
          className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-white p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">
              Customer payment info
            </p>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              {p.financeHandlingMode || 'AUTO_APPROVED'}
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Detail label="Lead ID" value={String(p.leadId)} />
            <Detail label="Amount" value={formatInr(p.amount)} />
            <Detail label="Customer name" value={p.customerName || '—'} />
            <Detail label="Payment method" value={p.paymentMethod || '—'} />
            <Detail label="Payment date & time" value={formatWhen(p.paidAt)} />
            <Detail label="Channel" value={p.paymentChannel || 'ONLINE'} />
            <Detail
              label="Transaction ID"
              value={p.transactionId || '—'}
              mono
              full
            />
            <Detail label="Merchant txn" value={p.merchantTxn || '—'} mono full />
            <Detail label="Link sent via" value={p.linkSentVia || 'Email'} />
            <Detail label="Link sent by" value={p.linkSentBy || '—'} />
            {p.customerEmail ? <Detail label="Customer email" value={p.customerEmail} full /> : null}
          </dl>
        </div>
      ))}
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd
        className={`mt-0.5 text-sm font-medium text-gray-900 break-all ${mono ? 'font-mono text-[12px]' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
