/**
 * Milestone: 40% PAYMENT – Design sign off (Sl no: 14)
 * Task: "Design sign off meeting request"
 * Trigger: After DQC 2 approval; designer requests design sign-off meeting.
 *
 * Sheet references:
 * - To CX from designer:
 *   https://docs.google.com/document/d/1J8jHU8Ck8OiEYOHIbAmVnbdg2gSXAblGsZ5pKhsX6z4/edit?usp=sharing
 *
 * Route: /new-mail/design-signoff-meeting-scheduled
 * Usage: invite mail for design sign-off meeting (leads into 40% payment).
 */

export default function DesignSignoffMeetingScheduledMailPage() {
  const customerName = "[Customer Name]";
  const meetingDate = "Friday, October 27, 2023";
  const meetingTime = "4:00 PM — 5:00 PM";
  const meetingMode = "Online (Video Call)";

  return (
    <div className="min-h-screen bg-[#f8f5ee] py-12 px-4">
      <div
        className="max-w-[640px] mx-auto bg-white rounded-[24px] shadow-md overflow-hidden"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
      >
        {/* Header */}
        <div className="pt-12 pb-10 px-8">
          <div className="flex items-center justify-center gap-3 mb-[15px]">
            <div className="w-9 h-10 shrink-0 flex items-center">
              <svg className="w-9 h-10" viewBox="0 0 36 40" fill="none" aria-hidden>
                <path d="M18 0L36 40H0L18 0Z" fill="#da4b3a" />
                <path d="M10 6 Q22 4 30 14 Q18 20 10 6Z" fill="white" />
              </svg>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-[16px] font-normal tracking-[0.08em] text-[#333333] uppercase leading-none">
                HUB Interior
              </p>
              <div className="h-px bg-[#d4d4d4] w-[70px] mt-2 mx-auto" />
            </div>
          </div>

          <div className="mb-[30px]" />

          <h1 className="text-[30px] leading-[1.15] font-extrabold text-black text-center mb-5 max-w-[480px] mx-auto">
            Design Sign‑Off Meeting Scheduled
          </h1>

          <p className="text-[17px] leading-[1.5] font-normal text-[#4a4a4a] text-center max-w-[480px] mx-auto mb-7">
            Hi {customerName}, we&apos;re ready for the final review of your
            designs before we move into production and execution. Let&apos;s walk
            through everything together.
          </p>

          {/* Meeting details */}
          <div className="bg-[#f5f2eb] rounded-[20px] px-7 py-5 shadow-sm">
            <div className="flex justify-between items-center py-4 border-b border-[#e0e0e0]">
              <span className="text-[13px] font-normal tracking-[0.1em] text-[#9ca3af] uppercase">
                Date
              </span>
              <span className="text-[17px] font-normal text-black">
                {meetingDate}
              </span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-[#e0e0e0]">
              <span className="text-[13px] font-normal tracking-[0.1em] text-[#9ca3af] uppercase">
                Time
              </span>
              <span className="text-[17px] font-normal text-black">
                {meetingTime}
              </span>
            </div>
            <div className="flex justify-between items-center py-4">
              <span className="text-[13px] font-normal tracking-[0.1em] text-[#9ca3af] uppercase">
                Mode
              </span>
              <span className="text-[15px] font-normal text-black">
                {meetingMode}
              </span>
            </div>
          </div>
        </div>

        {/* Body + CTA */}
        <div className="px-8 pb-0">
          <div className="flex items-start gap-3 mb-8">
            <span className="w-[9px] h-[9px] rounded-full bg-[#da4b3a] flex items-center justify-center shrink-0 mt-1.5">
              <span className="w-1 h-1 rounded-full bg-white" />
            </span>
            <p className="text-[15px] font-normal text-[#333333] leading-relaxed">
              In this meeting, we&apos;ll confirm every room, finalize any minor
              tweaks and lock the scope so we can proceed with the 40% payment and
              move towards production.
            </p>
          </div>

          <div className="text-center mb-10">
            <button
              type="button"
              className="w-full py-4 px-8 bg-[#da4b3a] text-white text-[17px] font-bold rounded-lg hover:bg-[#b51d1d] transition-colors mb-4"
            >
              Confirm This Meeting
            </button>
            <a
              href="#"
              className="text-[15px] text-[#da4b3a] font-normal underline hover:no-underline"
            >
              Request a different time
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8">
          <div className="h-px bg-[#e5e5e5] mb-8" />
          <div className="flex items-center gap-4 mb-8">
            <div className="w-11 h-11 rounded-full bg-gray-300 shrink-0" />
            <div>
              <p className="text-[17px] font-bold text-[#1f1f1f] leading-tight">
                Best, [Designer Name]
              </p>
              <p className="text-[13px] font-normal tracking-[0.08em] text-[#9ca3af] uppercase mt-0.5">
                Lead Designer, HUB Interior
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#f0ebe3] rounded-b-[24px] px-8 py-6">
          <p className="text-[11px] font-normal text-[#9ca3af] text-center">
            You&apos;re receiving this because your project has reached the Design
            Sign‑Off stage.
          </p>
        </div>
      </div>
    </div>
  );
}

