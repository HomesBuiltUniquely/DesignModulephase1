/**
 * Milestone: 40% PAYMENT – Design sign off (Sl no: 15)
 * Task: "40% collection" (after design sign-off meeting completed)
 * Trigger: Design sign‑off meeting completed; MOM + payable‑now amount submitted.
 *
 * Sheet references:
 * - Checklist:
 *   https://docs.google.com/document/d/1Qfux3y5Hk2rBYfM3uA8WK7oED0Rhz-VHrU1TviaUDv0/edit?usp=sharing
 * - Payment request mail:
 *   https://docs.google.com/document/d/1o9Yz1vVkNo7jY0bEX5MrrOCj_XyBaJNHIK4wT9VrMfY/edit?usp=sharing
 *
 * Route: /new-mail/design-signoff-40pc-payment-request
 * Usage: customer-facing mail requesting 40% payment after design sign‑off.
 */

export default function DesignSignoffFortyPercentPaymentRequestMailPage() {
  const customerName = "[Customer Name]";
  const projectId = "[Project ID]";
  const amountDue = "₹[40% Amount]";
  const dueDate = "[Due Date]";

  return (
    <div className="min-h-screen bg-[#f3e5d8] py-10 px-4">
      <div className="max-w-[640px] mx-auto bg-white rounded-[26px] shadow-md overflow-hidden">
        {/* Header */}
        <div className="pt-10 pb-7 px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className="w-10 h-10 bg-[#d62323] flex items-center justify-center rounded-md rotate-45">
              <span className="text-white font-bold text-xs -rotate-45">HI</span>
            </div>
            <span className="text-[18px] font-semibold text-black tracking-tight">
              HUB Interior
            </span>
          </div>
          <div className="h-px bg-[#f1e4d2] mb-6" />
          <div className="inline-flex items-center justify-center px-5 py-1 rounded-full bg-[#f6ebdd] text-[11px] font-semibold tracking-[0.16em] text-[#4c3a26] uppercase mb-4">
            40% Payment Milestone
          </div>
          <h1 className="text-[26px] leading-[1.3] font-semibold text-[#111827] mb-3">
            Design Sign‑Off &amp; 40% Payment Request
          </h1>
          <p className="text-[14px] leading-[1.7] text-[#4b5563] max-w-[500px] mx-auto">
            Hi {customerName}, thank you for completing the design sign‑off. To
            move your project into production and procurement, we request you to
            complete the 40% milestone payment.
          </p>
        </div>

        {/* Payment summary */}
        <div className="px-8 pt-6 pb-8 bg-[#fdf7f0]">
          <div className="bg-[#f8efdf] rounded-[18px] px-6 py-5 shadow-[0_6px_18px_rgba(0,0,0,0.03)] mb-6">
            <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold mb-3">
              Payment Summary
            </p>
            <div className="space-y-3 text-[13px] text-[#3b3b3b]">
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Project ID</span>
                <span className="font-medium text-[#111827]">{projectId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Milestone</span>
                <span className="font-medium text-[#111827]">
                  40% Design &amp; Production
                </span>
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

          <p className="text-[13px] text-[#4b5563] leading-relaxed mb-6">
            Once this payment is completed, we will initiate purchase orders,
            block production slots and share your detailed execution timeline.
          </p>

          {/* CTA */}
          <div className="text-center">
            <button
              type="button"
              className="w-full py-4 px-8 bg-[#d62323] text-white text-[15px] font-semibold rounded-full hover:bg-[#b51d1d] transition-colors mb-3"
            >
              Pay 40% Now
            </button>
            <p className="text-[12px] text-[#6b7280]">
              You can also complete the payment via bank transfer and share the
              confirmation with your designer or project manager.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pt-5 pb-8 bg-white">
          <p className="text-[13px] text-[#374151] mb-1">Warm regards,</p>
          <p className="text-[14px] font-semibold text-[#111827] mb-2">
            Team HUB Interior
          </p>
          <p className="text-[11px] text-[#9ca3af] leading-relaxed">
            You&apos;re receiving this mail as part of your active design contract
            with HUB Interior.
          </p>
        </div>
      </div>
    </div>
  );
}

