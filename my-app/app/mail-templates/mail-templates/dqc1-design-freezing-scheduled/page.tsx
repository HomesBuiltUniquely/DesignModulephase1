/**
 * DQC 1 - Design Freezing Discussion Scheduled
 * Trigger: Submit form with date of meeting + upload files (design finalisation meeting request)
 * Connected to: DQC 1 milestone, task "Design finalisation meeting request"
 * Mail UI ref: screen4.png (Design Freezing Discussion Scheduled)
 */
export default function Dqc1DesignFreezingScheduledPage() {
  const customerName = '[Customer Name]';
  const projectName = '[Project Name]';
  const meetingDate = 'Tuesday, October 24, 2023';
  const meetingTime = '10:30 AM — 11:30 AM (EST)';

  return (
    <div className="min-h-screen bg-[#f3e5d8] py-10 px-4">
      <div className="max-w-[640px] mx-auto bg-white rounded-[26px] shadow-md overflow-hidden">
        {/* ========== PART 1: Header, Title, Intro ========== */}
        <div className="pt-10 pb-7 px-8">
          {/* Brand */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-10 h-10 rounded-full bg-[#d62323] flex items-center justify-center mb-3 shadow-sm">
              <span className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-white text-xs">
                A
              </span>
            </div>
            <p className="text-[12px] tracking-[0.28em] uppercase text-[#111111]">
              HUB INTERIOR DESIGN
            </p>
          </div>

          {/* Thin divider under brand */}
          <div className="h-px w-full bg-[#f1e2d4] mb-7" />

          {/* Title */}
          <h1 className="text-[26px] leading-[1.3] font-semibold text-[#111111] mb-3">
            Design Freezing Discussion Scheduled
          </h1>

          {/* Intro copy */}
          <p className="text-[14px] leading-[1.7] text-[#4a4a4a] max-w-[520px]">
            Hello, we are moving into the final stage of your interior transformation.
            It&apos;s time for our{' '}
            <span className="font-semibold text-[#e53935]">Design Freezing Discussion</span>{' '}
            to finalize the layouts and project scope.
          </p>
        </div>

        {/* ========== PART 2: Meeting Details + Image + Agenda ========== */}
        <div className="px-8 pt-7 pb-8 bg-[#fdf7f0]">
          {/* Meeting card - SAME STYLE AS REFERENCE */}
          <div className="bg-[#f8efdf] rounded-[18px] px-5 py-4 mb-6 shadow-[0_6px_18px_rgba(0,0,0,0.03)]">
            {/* Title row */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-[4px] border border-[#d64532] flex items-center justify-center">
                <span className="w-3 h-3 border-[2px] border-[#d64532] rounded-[2px]" />
              </div>
              <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold">
                Meeting Details
              </p>
            </div>

            {/* Date row */}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[13px] text-[#7b7b7b]">Date</span>
              <span className="text-[13px] font-medium text-[#1f1f1f]">{meetingDate}</span>
            </div>

            {/* Time row */}
            <div className="flex items-center justify-between pt-1.5">
              <span className="text-[13px] text-[#7b7b7b]">Time</span>
              <span className="text-[13px] font-medium text-[#1f1f1f]">{meetingTime}</span>
            </div>
          </div>

          {/* Hero image placeholder */}
          <div className="w-full h-[190px] rounded-[18px] overflow-hidden bg-[#d3cbc4] mb-6 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
            <div className="w-full h-full bg-gradient-to-r from-[#2f2b2a] via-[#3b3634] to-[#262220] flex items-center justify-center">
              <span className="text-[12px] tracking-[0.18em] uppercase text-[#a3a3a3]">
                Final living room render placeholder
              </span>
            </div>
          </div>

          {/* Agenda / what to expect - SAME STYLE AS REFERENCE */}
          <div className="bg-[#f8efdf] rounded-[18px] px-5 py-5 shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
            {/* Title row */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-[4px] border border-[#d64532] flex items-center justify-center">
                <span className="w-3 h-3 border-t-2 border-l-2 border-[#d64532] rotate-[-45deg]" />
              </div>
              <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold">
                Meeting Agenda
              </p>
            </div>

            {/* Bullet list */}
            <ul className="space-y-2 text-[14px] leading-[1.7] text-[#3b3b3b]">
              <li className="flex items-start gap-3">
                <span className="mt-[7px] w-2 h-2 rounded-full bg-[#d62323]" />
                <span>
                  Final review and walkthrough of all{' '}
                  <span className="font-semibold">revised layouts</span>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-[7px] w-2 h-2 rounded-full bg-[#d62323]" />
                <span>
                  Selection and approval of{' '}
                  <span className="font-semibold">final design elements &amp; materials</span>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-[7px] w-2 h-2 rounded-full bg-[#d62323]" />
                <span>
                  Official sign-off on the{' '}
                  <span className="font-semibold">project scope</span> to begin procurement.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* ========== PART 3: CTA + Signature / Footer ========== */}
        <div className="px-8 pt-8 pb-9 bg-white">
          {/* CTA */}
          <div className="text-center mb-4">
            <button
              type="button"
              className="inline-flex items-center justify-center px-10 py-3 bg-[#d62323] text-white text-[14px] font-semibold rounded-[6px] shadow-[0_10px_20px_rgba(214,35,35,0.35)] hover:bg-[#b51d1d] transition-colors"
            >
              Confirm This Time
            </button>
          </div>
          <p className="text-[11px] text-[#9ca3af] text-center mb-8">
            If this time doesn&apos;t work for you, please reply to this email to reschedule.
          </p>

          {/* Signature row - matches reference */}
          <div className="flex items-start justify-between text-[12px] text-[#4b5563] mb-6">
            <div>
              <p className="mb-1">Warm regards,</p>
              <p className="font-semibold text-[#111827]">Julian Vance</p>
              <p className="text-[#d62323] text-[11px]">Lead Interior Architect</p>
            </div>
            <div className="text-right space-y-1">
              <p className="flex items-center justify-end gap-1">
                <span className="text-[13px] text-[#9ca3af]">☎</span>
                <span className="text-[12px] text-[#4b5563]">+1 (555) 012-3456</span>
              </p>
              <p className="flex items-center justify-end gap-1">
                <span className="text-[13px] text-[#9ca3af]">✉</span>
                <span className="text-[12px] text-[#4b5563]">julian@hubinteriors.design</span>
              </p>
            </div>
          </div>

          <div className="h-px bg-[#f1e2d4] mb-4" />

          <p className="text-[10px] tracking-[0.16em] uppercase text-[#b3b3b3] text-center">
            HUB INTERIOR DESIGN STUDIO · NEW YORK · LONDON · DUBAI
          </p>
        </div>
      </div>
    </div>
  );
}

