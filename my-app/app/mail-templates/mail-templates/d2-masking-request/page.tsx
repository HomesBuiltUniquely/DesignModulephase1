/**
 * Milestone: D2 SITE MASKING (Sl no: 9)
 * Task: "D2 - masking request raise"
 * Trigger: After DQC 1 approval; designer raises masking request and informs CX.
 *
 * Sheet references:
 * - CTA for MMT team with time/date/person pickers
 * - From Designer to CX mail:
 *   https://docs.google.com/document/d/1ZIUS9ae9bvz5zOkoFxfATN_t3v8qtBKQ5ydD9rbIBRg/edit?usp=sharing
 *
 * Route: /new-mail/d2-masking-request
 * Usage: customer-facing mail confirming that the D2 masking site visit is being scheduled.
 */

export default function D2MaskingRequestMailPage() {
  const customerName = "[Customer Name]";
  const projectName = "[Project Name]";
  const proposedDate = "[Proposed Date]";
  const proposedTime = "[Proposed Time Slot]";

  return (
    <div className="min-h-screen bg-[#f3e5d8] py-10 px-4">
      <div className="max-w-[640px] mx-auto bg-white rounded-[26px] shadow-md overflow-hidden">
        {/* Header / Brand */}
        <div className="pt-10 pb-7 px-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-10 h-10 rounded-full bg-[#d62323] flex items-center justify-center mb-3 shadow-sm">
              <span className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-white text-xs">
                D2
              </span>
            </div>
            <p className="text-[12px] tracking-[0.28em] uppercase text-[#111111]">
              HUB INTERIOR DESIGN
            </p>
          </div>
          <div className="h-px w-full bg-[#f1e2d4] mb-7" />
          <h1 className="text-[26px] leading-[1.3] font-semibold text-[#111111] mb-3">
            Site Masking Visit Request
          </h1>
          <p className="text-[14px] leading-[1.7] text-[#4a4a4a] max-w-[520px]">
            Hi {customerName}, based on the approved design, we are ready to move
            into the on-site masking stage for your project {projectName}. Please
            review the proposed slot below.
          </p>
        </div>

        {/* Visit details */}
        <div className="px-8 pt-6 pb-8 bg-[#fdf7f0]">
          <div className="bg-[#f8efdf] rounded-[18px] px-5 py-4 mb-6 shadow-[0_6px_18px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-[4px] border border-[#d64532] flex items-center justify-center">
                <span className="w-3 h-3 border-[2px] border-[#d64532] rounded-[2px]" />
              </div>
              <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold">
                Proposed Visit Slot
              </p>
            </div>
            <div className="space-y-2 text-[13px] text-[#3b3b3b]">
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Date</span>
                <span className="font-medium text-[#1f1f1f]">{proposedDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Time</span>
                <span className="font-medium text-[#1f1f1f]">{proposedTime}</span>
              </div>
            </div>
          </div>

          <p className="text-[13px] text-[#4b5563] leading-relaxed mb-6">
            During this visit, our team will mark the designs on-site to ensure
            alignment between drawings and your actual space. Kindly ensure site
            access and basic readiness.
          </p>

          {/* CTA */}
          <div className="text-center">
            <button
              type="button"
              className="inline-flex items-center justify-center px-10 py-3 bg-[#d62323] text-white text-[14px] font-semibold rounded-[6px] shadow-[0_10px_20px_rgba(214,35,35,0.35)] hover:bg-[#b51d1d] transition-colors mb-3"
            >
              Confirm Masking Slot
            </button>
            <p className="text-[11px] text-[#9ca3af]">
              If this slot does not work for you, please reply to this email with
              your preferred date and time.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pt-7 pb-9 bg-white">
          <p className="text-[13px] text-[#4b4b4b] mb-1">Warmly,</p>
          <p className="text-[14px] font-semibold text-[#111827] mb-2">
            Team HUB Interior
          </p>
          <p className="text-[11px] text-[#9ca3af] leading-relaxed">
            You&apos;re receiving this update as part of your active project with
            HUB Interior. We appreciate your support in keeping the project
            timelines on track.
          </p>
        </div>
      </div>
    </div>
  );
}

