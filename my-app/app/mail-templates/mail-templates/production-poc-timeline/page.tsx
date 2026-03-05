/**
 * Milestone: PUSH TO PRODUCTION (Sl no: 16) – POC mail & timeline submission
 * Task: "POC mail & Timeline submission"
 * Trigger: Production form submitted; project POC and timeline should be mailed to CX.
 *
 * Sheet references:
 * - POC + timeline mail:
 *   https://docs.google.com/document/d/1t881yJMhJzivWsWydk82B9eZEYkyjI2_aikStZFvvto/edit?usp=sharing
 *
 * Route: /new-mail/production-poc-timeline
 * Usage: introduce project POC along with a high-level execution timeline.
 */

export default function ProductionPocTimelineMailPage() {
  const customerName = "[Customer Name]";
  const projectId = "[Project ID]";
  const pocName = "[POC Name]";
  const pocPhone = "[POC Phone]";
  const pocEmail = "[POC Email]";

  const phases = [
    { title: "Production & Procurement", duration: "X–Y weeks" },
    { title: "Site Preparation", duration: "X–Y days" },
    { title: "Installation & Handover", duration: "X–Y weeks" },
  ];

  return (
    <div className="min-h-screen bg-[#f3e5d8] py-10 px-4">
      <div className="max-w-[640px] mx-auto bg-[#fdf9f3] rounded-[28px] shadow-md overflow-hidden">
        {/* Header */}
        <div className="px-7 pt-10 pb-6">
          <div className="flex flex-col items-center mb-7">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-9 h-9 bg-[#d62323] flex items-center justify-center rounded-md rotate-45">
                <span className="text-white font-bold text-xs -rotate-45">HI</span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[18px] font-semibold text-[#111827] leading-tight">
                  HUB Interior
                </span>
                <span className="text-[11px] tracking-[0.16em] uppercase text-[#9c8b73] mt-1">
                  Project Execution Desk
                </span>
              </div>
            </div>
            <div className="h-px bg-[#f0e0ce] w-full" />
          </div>

          <div className="text-center mb-7">
            <h1 className="text-[26px] leading-[1.3] font-semibold text-[#111827] mb-2">
              Your Project POC &amp; Timeline
            </h1>
            <p className="text-[14px] leading-[1.6] text-[#6b7280] max-w-[380px] mx-auto">
              Hi {customerName}, we&apos;re excited to move your project into
              production. Here&apos;s your primary point of contact and the
              high‑level timeline.
            </p>
          </div>
        </div>

        {/* POC + timeline */}
        <div className="px-7 pb-8">
          <div className="bg-white rounded-[24px] px-6 py-6 shadow-sm mb-6">
            <p className="text-[13px] font-semibold text-[#111827] mb-3">
              Your Project Details
            </p>
            <div className="space-y-2 text-[13px] text-[#4b5563] mb-5">
              <p>
                <span className="text-[#9ca3af]">Project ID:&nbsp;</span>
                <span className="font-medium text-[#111827]">{projectId}</span>
              </p>
              <p>
                <span className="text-[#9ca3af]">Primary POC:&nbsp;</span>
                <span className="font-medium text-[#111827]">{pocName}</span>
              </p>
              <p>
                <span className="text-[#9ca3af]">Contact:&nbsp;</span>
                <span className="font-medium text-[#111827]">
                  {pocPhone} · {pocEmail}
                </span>
              </p>
            </div>

            <p className="text-[13px] font-semibold text-[#111827] mb-3">
              Indicative Timeline
            </p>
            <div className="space-y-3">
              {phases.map((phase, index) => (
                <div key={phase.title} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#d62323] text-white text-[13px] font-semibold flex items-center justify-center mt-0.5">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#111827] leading-snug">
                      {phase.title}
                    </p>
                    <p className="text-[13px] text-[#6b7280] leading-snug">
                      {phase.duration}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#ffe7e7] rounded-[18px] px-6 py-5 shadow-sm">
            <p className="text-[15px] font-semibold text-[#111827] mb-1">
              We&apos;re on this journey with you.
            </p>
            <p className="text-[13px] text-[#4b5563] leading-[1.6]">
              Your POC will keep you updated at every major milestone. For any
              urgent queries, feel free to reach out on the shared contact
              details.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#efddc8] px-6 pt-8 pb-7 text-center">
          <p className="text-[11px] tracking-[0.16em] uppercase text-[#8b7660] mb-1">
            © 2024 HUB INTERIOR DESIGN STUDIO
          </p>
          <p className="text-[11px] tracking-[0.08em] uppercase text-[#8b7660] mb-1">
            This email was sent regarding your project&apos;s production phase.
          </p>
        </div>
      </div>
    </div>
  );
}

