/**
 * Milestone: 10% PAYMENT (Sl no: 7)
 * Task: "10% payment collection" – automated mail for 10% payment
 * Trigger: DQC 1 approved and submitted (estimate approved)
 *
 * Sheet references:
 * - "For CX - automated mail for 10% payment on the DQC 1 approved estimate, with Account Details"
 * - Internal mail loop (designer) + CX mail:
 *   https://docs.google.com/document/d/1fuM2_HvpIxwXSlIwki7YneNNUH3w2FS8nZ5Rs6Xpg2s/edit?usp=sharing
 *
 * Route: /new-mail/ten-percent-payment-request
 * Usage: send to customer with payment summary + account details + CTA to pay.
 */

export default function TenPercentPaymentRequestMailPage() {
  const customerName = "[Customer Name]";
  const projectId = "[Project ID]";
  const propertyType = "[Property Type]";
  const amountDue = "₹[Amount]";
  const dueDate = "[Due Date]";

  return (
    <div className="min-h-screen bg-[#f3e5d8] py-10 px-4">
      <div className="max-w-[640px] mx-auto bg-white rounded-[26px] shadow-md overflow-hidden">
        {/* Header / Brand */}
        <div className="pt-10 pb-7 px-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-10 h-10 bg-[#d62323] flex items-center justify-center rounded-md rotate-45">
              <span className="text-white font-bold text-sm -rotate-45">HI</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[18px] font-semibold text-[#111827] leading-tight">
                HUB Interior
              </span>
            </div>
          </div>
          <div className="h-px bg-[#f1e4d2] mb-6" />
          <div className="inline-flex items-center justify-center px-5 py-1 rounded-full bg-[#f6ebdd] text-[11px] font-semibold tracking-[0.16em] text-[#4c3a26] uppercase mb-4">
            Payment Milestone
          </div>
          <h1 className="text-[26px] leading-[1.3] font-semibold text-[#111827] mb-3">
            10% Design Payment Request
          </h1>
          <p className="text-[14px] leading-[1.7] text-[#4b5563] max-w-[480px] mx-auto">
            Hi {customerName}, your design has been approved by our DQC team.
            To move ahead with masking and the next set of activities, we
            request you to complete the 10% design payment.
          </p>
        </div>

        {/* Payment summary */}
        <div className="px-8 pb-8 bg-[#fdf7f0]">
          <div className="bg-[#f8efdf] rounded-[18px] px-6 py-5 shadow-[0_6px_18px_rgba(0,0,0,0.03)] mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold">
                Payment Summary
              </p>
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#fde7e5] text-[11px] font-semibold text-[#d62323] uppercase tracking-[0.12em]">
                10% Milestone
              </span>
            </div>
            <div className="space-y-3 text-[13px] text-[#3b3b3b]">
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Project ID</span>
                <span className="font-medium text-[#111827]">{projectId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Property Type</span>
                <span className="font-medium text-[#111827]">{propertyType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Amount Due</span>
                <span className="font-semibold text-[#16a34a]">{amountDue}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Due Date</span>
                <span className="font-medium text-[#111827]">{dueDate}</span>
              </div>
            </div>
          </div>

          {/* Account details */}
          <div className="bg-white rounded-[18px] px-6 py-5 shadow-sm border border-[#f3e2d0] mb-7">
            <p className="text-[13px] font-semibold text-[#111827] mb-3">
              Bank Account Details
            </p>
            <div className="grid grid-cols-2 gap-3 text-[12px] text-[#4b5563]">
              <div>
                <p className="uppercase text-[11px] tracking-[0.14em] text-[#9ca3af] mb-1">
                  Account Name
                </p>
                <p className="font-medium text-[#111827]">Hub Interior Pvt. Ltd.</p>
              </div>
              <div>
                <p className="uppercase text-[11px] tracking-[0.14em] text-[#9ca3af] mb-1">
                  Account Number
                </p>
                <p className="font-medium text-[#111827]">XXXXXX1234</p>
              </div>
              <div>
                <p className="uppercase text-[11px] tracking-[0.14em] text-[#9ca3af] mb-1">
                  IFSC Code
                </p>
                <p className="font-medium text-[#111827]">XXXX0001234</p>
              </div>
              <div>
                <p className="uppercase text-[11px] tracking-[0.14em] text-[#9ca3af] mb-1">
                  Payment Reference
                </p>
                <p className="font-medium text-[#111827]">{projectId}-10PCT</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mb-6">
            <button
              type="button"
              className="w-full py-4 px-6 bg-[#d62323] text-white text-[14px] font-semibold rounded-full shadow-[0_10px_20px_rgba(214,35,35,0.35)] hover:bg-[#b51d1d] transition-colors"
            >
              Pay 10% Now
            </button>
            <p className="text-[12px] text-[#6b7280] mt-3">
              You can also make a bank transfer using the above details and share the
              confirmation screenshot with your designer.
            </p>
          </div>
        </div>

        {/* Footer / Signature */}
        <div className="px-8 pt-5 pb-8 bg-white">
          <p className="text-[13px] text-[#374151] mb-1">Warm regards,</p>
          <p className="text-[14px] font-semibold text-[#111827] mb-4">
            Team HUB Interior
          </p>
          <p className="text-[11px] text-[#9ca3af] leading-relaxed">
            This payment helps us lock your design scope and move into the next
            execution stage. If you have any questions about this request, please
            reply to this email or contact your designer directly.
          </p>
        </div>
      </div>
    </div>
  );
}

