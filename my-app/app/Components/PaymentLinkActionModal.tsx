'use client';

import { useEffect, useState } from 'react';

export type PaymentLinkActionMode = 'edit' | 'cancel';

type Props = {
  open: boolean;
  mode: PaymentLinkActionMode;
  busy?: boolean;
  /** Current / default amount for edit mode */
  amount?: number | null;
  onClose: () => void;
  onEditSave: (amount: number) => void;
  onCancelConfirm: (notifyCustomer: boolean) => void;
};

/**
 * In-app popup for Edit amount / Cancel payment link (replaces browser confirm/prompt).
 * Same pattern as Design lead cancel / hold modals.
 */
export default function PaymentLinkActionModal({
  open,
  mode,
  busy = false,
  amount,
  onClose,
  onEditSave,
  onCancelConfirm,
}: Props) {
  const [editValue, setEditValue] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNotifyCustomer(true);
    setEditValue(amount != null && Number.isFinite(Number(amount)) ? String(Math.round(Number(amount))) : '');
  }, [open, mode, amount]);

  if (!open) return null;

  const handleEditSave = () => {
    const n = Number(String(editValue).replace(/,/g, '').trim());
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a valid amount greater than 0.');
      return;
    }
    onEditSave(n);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[2px] animate-backdropFadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-md animate-modalPopIn overflow-hidden rounded-2xl border border-[#e0e5ec] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-link-action-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#eef1f5] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                  mode === 'cancel' ? 'bg-red-50 text-red-600' : 'bg-[#ecfdf5] text-[#059669]'
                }`}
              >
                {mode === 'cancel' ? '✕' : '₹'}
              </span>
              <h2
                id="payment-link-action-title"
                className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#374151]"
              >
                {mode === 'cancel' ? 'Cancel payment link' : 'Edit payment amount'}
              </h2>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[#6b7280]">
              {mode === 'cancel'
                ? 'This link will stop working for the customer. You can send a new link later.'
                : 'Update the amount and we will create a new link. The old link will be deactivated.'}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] transition hover:bg-[#f9fafb] disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {mode === 'edit' ? (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
                New amount (₹)
              </span>
              <div className="flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-3 focus-within:border-[#00B0ED] focus-within:ring-2 focus-within:ring-[#00B0ED]/20">
                <span className="text-[14px] font-semibold text-[#374151]">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editValue}
                  disabled={busy}
                  autoFocus
                  onChange={(e) => {
                    setEditValue(e.target.value.replace(/[^\d]/g, ''));
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditSave();
                  }}
                  className="h-11 w-full bg-transparent text-[15px] font-semibold tabular-nums text-[#111827] outline-none disabled:opacity-60"
                  placeholder="0"
                />
              </div>
            </label>
          ) : (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-3.5 py-3 transition hover:border-[#d1d5db]">
              <input
                type="checkbox"
                checked={notifyCustomer}
                disabled={busy}
                onChange={(e) => setNotifyCustomer(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#059669] focus:ring-[#059669]"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[#111827]">
                  Email customer about this cancel
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-[#6b7280]">
                  Send the “do not use this payment link” email. Uncheck to cancel the link only.
                </span>
              </span>
            </label>
          )}

          {error ? <p className="text-[12px] font-medium text-[#EF0101]">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#eef1f5] bg-[#fafafa] px-5 py-3.5">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d1d5db] bg-white px-4 text-[12px] font-semibold text-[#374151] transition hover:bg-[#f3f4f6] disabled:opacity-60"
          >
            {mode === 'cancel' ? 'Keep link' : 'Back'}
          </button>
          {mode === 'edit' ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleEditSave}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#059669] px-4 text-[12px] font-bold uppercase tracking-wide text-white transition hover:bg-[#047857] disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save amount'}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onCancelConfirm(notifyCustomer)}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#b91c1c] px-4 text-[12px] font-bold uppercase tracking-wide text-white transition hover:bg-[#991b1b] disabled:opacity-60"
            >
              {busy ? 'Cancelling…' : 'Cancel link'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
