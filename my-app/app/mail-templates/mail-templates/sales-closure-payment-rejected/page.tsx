/**
 * Mail template preview: Sales Closure Payment Rejected
 * Route: /mail-templates/mail-templates/sales-closure-payment-rejected
 *
 * Trigger: Finance rejects the payment screenshot submitted via the Sales Closure form.
 * Recipients:
 *   - To: Sales person email (sales_email in payload)
 *   - CC: Sales Lead email (sales_lead_email) and Sales SPOC email (sales_spoc_email) if available
 */

export default function SalesClosurePaymentRejectedMailPage() {
  const salesPersonName = "[Sales Person Name]";
  const customerName = "[Customer Name]";
  const leadId = "[Lead ID]";

  return (
    <div className="min-h-screen bg-[#fef2f2] py-10 px-4">
      <div className="max-w-[640px] mx-auto bg-white rounded-[26px] shadow-md overflow-hidden">
        {/* Header / Brand */}
        <div className="pt-10 pb-7 px-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-10 h-10 bg-red-600 flex items-center justify-center rounded-md">
              <span className="text-white font-bold text-sm">✕</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[18px] font-semibold text-[#111827] leading-tight">
                HUB Interior Finance
              </span>
            </div>
          </div>
          <div className="h-px bg-red-100 mb-6" />
          <div className="inline-flex items-center justify-center px-5 py-1 rounded-full bg-red-100 text-[11px] font-semibold tracking-[0.16em] text-red-800 uppercase mb-4">
            Action Required
          </div>
          <h1 className="text-[26px] leading-[1.3] font-semibold text-[#111827] mb-3">
            Payment Rejected
          </h1>
          <p className="text-[14px] leading-[1.7] text-[#4b5563] max-w-[480px] mx-auto">
            Hi {salesPersonName}, the payment screenshot you submitted for the
            sales closure has been reviewed and{" "}
            <strong className="text-red-600">rejected</strong> by the Finance
            team.
          </p>
        </div>

        {/* Details card */}
        <div className="px-8 pb-8 bg-[#fff7f7]">
          <div className="bg-white rounded-[18px] px-6 py-5 shadow-[0_6px_18px_rgba(0,0,0,0.03)] border border-red-200 mb-6">
            <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold mb-3">
              Submission Details
            </p>
            <div className="space-y-3 text-[13px] text-[#3b3b3b]">
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Lead ID</span>
                <span className="font-semibold text-[#111827]">{leadId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Customer Name</span>
                <span className="font-medium text-[#111827]">
                  {customerName}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
            <p className="text-[13px] leading-relaxed text-red-900">
              <strong>Next steps:</strong> Please reach out to the Finance team
              for clarification, or re-upload the correct payment screenshot via
              the Sales Closure form using the same Lead ID. Your submission will
              be reviewed again by Finance.
            </p>
          </div>

          <p className="text-[13px] text-[#4b5563] leading-relaxed">
            If you believe this rejection was made in error, please contact the
            Finance team directly and reference Lead ID{" "}
            <strong>{leadId}</strong>.
          </p>

          <div className="mt-5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <p className="text-[12px] text-blue-800 font-medium">
              Note: In the Sales Closure form, please search using the given <strong>Lead ID (#{leadId})</strong> to fetch and re-submit your data.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pt-5 pb-8 bg-white">
          <p className="text-[13px] text-[#374151] mb-1">Regards,</p>
          <p className="text-[14px] font-semibold text-[#111827] mb-2">
            Finance Team, HUB Interior
          </p>
          <p className="text-[11px] text-[#9ca3af] leading-relaxed">
            This is an automated notification. For any clarifications, please
            write to finance@hubinterior.com and mention your Lead ID in the
            subject line.
          </p>
        </div>
      </div>
    </div>
  );
}
