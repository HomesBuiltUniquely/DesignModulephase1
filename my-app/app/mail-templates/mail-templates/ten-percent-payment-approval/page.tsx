/**
 * Milestone: 10% PAYMENT (Sl no: 8)
 * Task: "10% payment approval" – payment confirmed by finance
 * Trigger: Finance marks payment confirmed; automated receipt mail to CX.
 *
 * Sheet references:
 * - "Automated receipt from finance team"
 * - Receipt content:
 *   https://docs.google.com/document/d/1sytX_Yu0-z2O2vwwrXUNYhT6w6WsVXKOMiRvCCT9Cx0/edit?usp=sharing
 *
 * Route: /new-mail/ten-percent-payment-approval
 * Usage: send to customer as acknowledgement + receipt for the 10% payment.
 */

export default function TenPercentPaymentApprovalMailPage() {
  const customerName = "[Customer Name]";
  const projectId = "[Project ID]";
  const amountPaid = "₹[Amount]";
  const paymentDate = "[Payment Date]";
  const transactionRef = "[Transaction Reference]";

  return (
    <div className="min-h-screen bg-[#f3e5d8] py-10 px-4">
      <div className="max-w-[640px] mx-auto bg-white rounded-[26px] shadow-md overflow-hidden">
        {/* Header / Brand */}
        <div className="pt-10 pb-7 px-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-10 h-10 bg-[#16a34a] flex items-center justify-center rounded-md">
              <span className="text-white font-bold text-sm">✓</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[18px] font-semibold text-[#111827] leading-tight">
                HUB Interior Finance
              </span>
            </div>
          </div>
          <div className="h-px bg-[#e5f3e9] mb-6" />
          <div className="inline-flex items-center justify-center px-5 py-1 rounded-full bg-[#e7f6ed] text-[11px] font-semibold tracking-[0.16em] text-[#166534] uppercase mb-4">
            Payment Received
          </div>
          <h1 className="text-[26px] leading-[1.3] font-semibold text-[#111827] mb-3">
            10% Payment Confirmation
          </h1>
          <p className="text-[14px] leading-[1.7] text-[#4b5563] max-w-[480px] mx-auto">
            Hi {customerName}, thank you for completing your 10% design payment.
            This email is an acknowledgement of the amount received for your HUB
            Interior project.
          </p>
        </div>

        {/* Receipt card */}
        <div className="px-8 pb-8 bg-[#fdf7f0]">
          <div className="bg-white rounded-[18px] px-6 py-5 shadow-[0_6px_18px_rgba(0,0,0,0.03)] border border-[#e5f0e8] mb-6">
            <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold mb-3">
              Receipt Details
            </p>
            <div className="space-y-3 text-[13px] text-[#3b3b3b]">
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Project ID</span>
                <span className="font-medium text-[#111827]">{projectId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Amount Paid</span>
                <span className="font-semibold text-[#16a34a]">{amountPaid}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Payment Date</span>
                <span className="font-medium text-[#111827]">{paymentDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Transaction Ref</span>
                <span className="font-medium text-[#111827]">
                  {transactionRef}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[13px] text-[#4b5563] leading-relaxed">
            Your designer will now proceed with D2 masking and the subsequent
            design activities as per the agreed timeline. You will continue to
            receive milestone updates as your project progresses.
          </p>
        </div>

        {/* Footer */}
        <div className="px-8 pt-5 pb-8 bg-white">
          <p className="text-[13px] text-[#374151] mb-1">Regards,</p>
          <p className="text-[14px] font-semibold text-[#111827] mb-2">
            Finance Team, HUB Interior
          </p>
          <p className="text-[11px] text-[#9ca3af] leading-relaxed">
            This is an automated receipt. For any clarifications related to your
            payment, please write to finance@hubinterior.com and mention your
            project ID in the subject line.
          </p>
        </div>
      </div>
    </div>
  );
}

