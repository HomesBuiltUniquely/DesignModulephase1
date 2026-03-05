/**
 * Milestone: DQC 2 (Sl no: 12) – DQC 2 submission
 * Task: "DQC 2 submission" – final design + estimate submitted
 * Trigger: Designer submits final design PDFs + final estimate for DQC 2.
 *
 * Sheet references:
 * - Designer uploads final design PDFs + final estimate (internal)
 * - Automated message to CX:
 *   https://docs.google.com/document/d/12DtaHPjZkkGCGL-pSryGXy9rqoMYxt1W-IcbuHt7-xo/edit?usp=sharing
 *
 * Route: /new-mail/dqc2-final-design-submission
 * Usage: customer-facing mail informing that final design set has been shared for approval.
 */

export default function Dqc2FinalDesignSubmissionMailPage() {
  const customerName = "[Customer Name]";
  const projectId = "[Project ID]";
  const propertyType = "[Property Type]";
  const estimateVersion = "R2 – Final";

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
            Final Design Shared
          </div>
          <h1 className="text-[26px] leading-[1.3] font-semibold text-[#111827] mb-3">
            Your Final Design &amp; Estimate Are Ready
          </h1>
          <p className="text-[14px] leading-[1.7] text-[#4b5563] max-w-[500px] mx-auto">
            Hi {customerName}, we&apos;ve completed the DQC 2 review and prepared
            the final design set and estimate for your project. Please review the
            attached documents at your convenience.
          </p>
        </div>

        {/* Snapshot card */}
        <div className="px-8 pt-6 pb-8 bg-[#fdf7f0]">
          <div className="bg-[#f8efdf] rounded-[18px] px-6 py-5 shadow-[0_6px_18px_rgba(0,0,0,0.03)] mb-6">
            <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold mb-3">
              Project Snapshot
            </p>
            <div className="grid grid-cols-2 gap-3 text-[13px] text-[#3b3b3b]">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#9ca3af] mb-1">
                  Project ID
                </p>
                <p className="font-medium text-[#111827]">{projectId}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#9ca3af] mb-1">
                  Property Type
                </p>
                <p className="font-medium text-[#111827]">{propertyType}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#9ca3af] mb-1">
                  Design Stage
                </p>
                <p className="font-medium text-[#111827]">DQC 2 – Final Design</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#9ca3af] mb-1">
                  Estimate Version
                </p>
                <p className="font-medium text-[#111827]">{estimateVersion}</p>
              </div>
            </div>
          </div>

          <p className="text-[13px] text-[#4b5563] leading-relaxed mb-6">
            The documents shared include your final drawings, selected materials and
            a detailed cost breakdown. Kindly review and share your feedback or
            approval so we can move to the design sign-off and payment stage.
          </p>

          {/* CTA */}
          <div className="text-center">
            <button
              type="button"
              className="w-full py-4 px-8 bg-[#d62323] text-white text-[15px] font-semibold rounded-full hover:bg-[#b51d1d] transition-colors mb-3"
            >
              View Final Design &amp; Estimate
            </button>
            <p className="text-[12px] text-[#6b7280]">
              If you have any questions, please reply to this email or reach out
              to your designer directly.
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
            You&apos;re receiving this update because your project has progressed
            to DQC 2 final submission stage.
          </p>
        </div>
      </div>
    </div>
  );
}

