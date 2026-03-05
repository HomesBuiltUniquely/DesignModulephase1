/**
 * Milestone: PUSH TO PRODUCTION (Sl no: 16) – CX approval for production
 * Task: "Cx approval for production" – final designs + estimate + works contract
 * Trigger: Designer submits final design PDFs, final estimate and works contract.
 *
 * Sheet references:
 * - CX approval for production mail:
 *   https://docs.google.com/document/d/17-0BJpA0GU9k2PNwcHHdKQGLnk8OsIl9yv6m8gmsww0/edit?usp=sharing
 *
 * Route: /new-mail/production-approval-request
 * Usage: asks customer to review and approve for production start.
 */

export default function ProductionApprovalRequestMailPage() {
  const customerName = "[Customer Name]";
  const projectId = "[Project ID]";
  const projectValue = "₹[Project Value]";

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
            Production Approval
          </div>
          <h1 className="text-[26px] leading-[1.3] font-semibold text-[#111827] mb-3">
            Approve Your Project for Production
          </h1>
          <p className="text-[14px] leading-[1.7] text-[#4b5563] max-w-[500px] mx-auto">
            Hi {customerName}, we&apos;ve prepared your final design set, estimate
            and works contract. Please review and approve to kickstart production
            activities for your project.
          </p>
        </div>

        {/* Summary card */}
        <div className="px-8 pt-6 pb-8 bg-[#fdf7f0]">
          <div className="bg-[#f8efdf] rounded-[18px] px-6 py-5 shadow-[0_6px_18px_rgba(0,0,0,0.03)] mb-6">
            <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold mb-3">
              Project Summary
            </p>
            <div className="space-y-3 text-[13px] text-[#3b3b3b]">
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Project ID</span>
                <span className="font-medium text-[#111827]">{projectId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Project Value</span>
                <span className="font-semibold text-[#111827]">{projectValue}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Current Stage</span>
                <span className="font-medium text-[#111827]">
                  Ready for Production
                </span>
              </div>
            </div>
          </div>

          <p className="text-[13px] text-[#4b5563] leading-relaxed mb-6">
            By approving this stage, you confirm that you have reviewed the final
            designs, the commercial terms and the works contract shared with you.
          </p>

          {/* CTA */}
          <div className="text-center">
            <button
              type="button"
              className="w-full py-4 px-8 bg-[#d62323] text-white text-[15px] font-semibold rounded-full hover:bg-[#b51d1d] transition-colors mb-3"
            >
              Approve for Production
            </button>
            <a
              href="#"
              className="text-[13px] text-[#d62323] font-normal underline hover:no-underline"
            >
              View attached documents
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pt-5 pb-8 bg-white">
          <p className="text-[13px] text-[#374151] mb-1">Warm regards,</p>
          <p className="text-[14px] font-semibold text-[#111827] mb-2">
            Team HUB Interior
          </p>
          <p className="text-[11px] text-[#9ca3af] leading-relaxed">
            You&apos;re receiving this because your project is ready to be pushed
            into production. For queries related to scope, payment or timelines,
            please reach out to your designer or project manager.
          </p>
        </div>
      </div>
    </div>
  );
}

