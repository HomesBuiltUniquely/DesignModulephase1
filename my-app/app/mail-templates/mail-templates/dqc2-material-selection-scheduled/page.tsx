/**
 * Milestone: DQC 2 (Sl no: 11) – Material selection meeting + quotation discussion
 * Task: "Material selection meeting + quotation discussion" – meeting request
 * Trigger: Same day of D2 (files upload completed).
 *
 * Sheet references:
 * - Customer-facing mail content:
 *   https://docs.google.com/document/d/1rELXiKK0gyq5WbB7wSkoy3DKgmPhR7TTGEH5yzWEKRY/edit?usp=sharing
 *
 * Route: /new-mail/dqc2-material-selection-scheduled
 * Usage: invite mail to schedule/confirm the DQC 2 material selection meeting.
 */

export default function Dqc2MaterialSelectionScheduledMailPage() {
  const customerName = "[Customer Name]";
  const meetingDate = "Tuesday, October 24, 2023";
  const meetingTime = "3:00 PM — 4:30 PM";
  const meetingMode = "Offline (at HUB Experience Center)";

  return (
    <div className="min-h-screen bg-[#f3e5d8] py-10 px-4">
      <div className="max-w-[640px] mx-auto bg-white rounded-[26px] shadow-md overflow-hidden">
        {/* Header / Brand */}
        <div className="pt-10 pb-7 px-8">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-9 h-10 shrink-0 flex items-center">
              <svg className="w-9 h-10" viewBox="0 0 36 40" fill="none" aria-hidden>
                <path d="M18 0L36 40H0L18 0Z" fill="#da4b3a" />
                <path d="M10 6 Q22 4 30 14 Q18 20 10 6Z" fill="white" />
              </svg>
            </div>
            <div className="flex flex-col">
              <p className="text-[16px] font-normal tracking-[0.08em] text-[#333333] uppercase leading-none">
                HUB Interior
              </p>
              <span className="text-[11px] text-[#9ca3af] tracking-[0.16em] uppercase mt-1">
                Design Quality Check – DQC 2
              </span>
            </div>
          </div>
          <div className="h-px bg-[#f1e4d2] mb-7" />

          <h1 className="text-[28px] leading-[1.2] font-semibold text-[#111827] mb-3">
            Material Selection Meeting Scheduled
          </h1>
          <p className="text-[14px] leading-[1.7] text-[#4b5563] max-w-[520px]">
            Hi {customerName}, we&apos;re ready to review materials, finishes and
            specifications for your home. This session will help us freeze the
            exact look and feel of your space.
          </p>
        </div>

        {/* Meeting details + image */}
        <div className="px-8 pt-6 pb-8 bg-[#fdf7f0]">
          <div className="bg-[#f5f2eb] rounded-[18px] px-6 py-5 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold">
                Meeting Details
              </p>
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#fde7e5] text-[11px] font-semibold text-[#d62323] uppercase tracking-[0.12em]">
                DQC 2
              </span>
            </div>
            <div className="space-y-3 text-[13px] text-[#3b3b3b]">
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Date</span>
                <span className="font-medium text-[#111827]">{meetingDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Time</span>
                <span className="font-medium text-[#111827]">{meetingTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7b7b7b]">Mode</span>
                <span className="font-medium text-[#111827]">{meetingMode}</span>
              </div>
            </div>
          </div>

          <div className="w-full h-[190px] rounded-[18px] overflow-hidden bg-[#e8e0d0] mb-6 shadow-sm flex items-center justify-center">
            <div className="text-[#9ca3af] text-sm">
              [Material boards, laminate swatches, fabrics on a design table]
            </div>
          </div>

          <p className="text-[13px] text-[#4b5563] leading-relaxed mb-6">
            During this session, we&apos;ll walk you through material combinations
            for each room, so you can see how everything comes together before we
            move into final drawings and estimates.
          </p>

          {/* CTA */}
          <div className="text-center">
            <button
              type="button"
              className="w-full py-4 px-8 bg-[#da4b3a] text-white text-[15px] font-bold rounded-lg hover:bg-[#b51d1d] transition-colors mb-3"
            >
              Confirm This Material Session
            </button>
            <a
              href="#"
              className="text-[13px] text-[#da4b3a] font-normal underline hover:no-underline"
            >
              Request a different time
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pt-7 pb-9 bg-white">
          <p className="text-[13px] text-[#4b4b4b] mb-1">Warm regards,</p>
          <p className="text-[14px] font-semibold text-[#111827] mb-2">
            Design Team, HUB Interior
          </p>
          <p className="text-[11px] text-[#9ca3af] leading-relaxed">
            You&apos;re receiving this because your project has progressed to DQC 2.
            We look forward to finalizing the right material palette for your home.
          </p>
        </div>
      </div>
    </div>
  );
}

