/**
 * Milestone helper: Project Design Timeline (used across multiple milestones)
 * Primary usage in sheet:
 * - DQC 1 "meeting completed" → Timeline mail if not automated
 * - Later stages as a generic "project timeline" reference mail
 *
 * This template is a reusable timeline email that can be sent
 * after key meetings (e.g. First Cut, Design Freeze) to show
 * the overall journey and upcoming steps.
 */
export default function ProjectDesignTimelineMailPage() {
  const customerName = '[Customer Name]';

  const steps = [
    { id: 1, title: 'Initial Consultation', description: 'Within 2 days' },
    { id: 2, title: 'Site Measurement', description: 'Scheduled within 1 week' },
    { id: 3, title: 'Concept Development', description: '3–5 Business days' },
    { id: 4, title: 'Design Presentation', description: 'Scheduled session' },
    { id: 5, title: 'Material Selection', description: '2–4 Business days' },
    { id: 6, title: 'Revised Drafts', description: 'Within 3 days' },
    { id: 7, title: 'Final Design Approval', description: 'Major milestone' },
    { id: 8, title: 'Budget Estimation', description: '2 Business days' },
    { id: 9, title: 'Contract Signing', description: 'Upon review' },
    { id: 10, title: 'Procurement', description: 'Ongoing process' },
    { id: 11, title: 'Site Preparation', description: 'Site ready for installation' },
    { id: 12, title: 'Installation & Styling', description: 'On-site execution' },
    { id: 13, title: 'Final Handover', description: 'Project completion' },
  ];

  return (
    <div className="min-h-screen bg-[#f3e5d8] py-10 px-4">
      <div className="max-w-[640px] mx-auto bg-[#fdf9f3] rounded-[28px] shadow-md overflow-hidden">
        {/* Top card container */}
        <div className="px-7 sm:px-10 pt-10 pb-6 bg-[#fdf9f3]">
          {/* Brand */}
          <div className="flex flex-col items-center mb-7">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-9 h-9 bg-[#d62323] flex items-center justify-center rounded-md rotate-45">
                <span className="text-white font-bold text-xs -rotate-45">HI</span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[18px] font-semibold text-[#111827] leading-tight">
                  HUB Interior
                </span>
              </div>
            </div>
            <div className="h-px bg-[#f0e0ce] w-full" />
          </div>

          {/* Title & intro */}
          <div className="text-center mb-7">
            <h1 className="text-[26px] leading-[1.3] font-semibold text-[#111827] mb-1">
              Project Design Timeline
            </h1>
            <p className="text-[14px] leading-[1.6] text-[#6b7280] max-w-[360px] mx-auto">
              Your journey to a beautiful space starts here.
            </p>
          </div>
        </div>

        {/* Steps list */}
        <div className="px-7 sm:px-10 pb-8 bg-[#fdf9f3]">
          <div className="bg-white rounded-[24px] px-6 py-6 shadow-sm">
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-[18px] top-3 bottom-3 w-[2px] bg-[#f2d3c3]" />

              <div className="space-y-5">
                {steps.map((step) => (
                  <div key={step.id} className="flex items-start gap-4">
                    {/* Number bullet */}
                    <div className="relative z-10 mt-0.5 flex-shrink-0">
                      <div
                        className="inline-block rounded-full bg-[#d62323] text-white text-[13px] font-semibold text-center"
                        style={{ width: 28, height: 28, lineHeight: "28px" }}
                      >
                        {step.id}
                      </div>
                    </div>

                    {/* Content */}
                    <div>
                      <p className="text-[15px] font-semibold text-[#111827] leading-snug">
                        {step.title}
                      </p>
                      <p className="text-[13px] text-[#6b7280] leading-snug">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom message + CTA */}
        <div className="px-7 sm:px-10 pb-10 bg-[#fdf9f3]">
          <div className="bg-[#ffe7e7] rounded-[18px] px-6 py-5 shadow-sm">
            <p className="text-[15px] font-semibold text-[#111827] mb-1">
              We&apos;re excited to bring your vision to life.
            </p>
            <p className="text-[13px] text-[#4b5563] leading-[1.6] mb-4">
              Our team is dedicated to crafting a space that reflects your unique style
              and needs.
            </p>
            <p className="text-[13px] text-[#4b5563] mb-1">
              Warmly,
            </p>
            <p className="text-[13px] font-semibold text-[#d62323] mb-4">
              Team HUB
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                className="inline-flex items-center justify-center px-7 py-3 bg-[#e0392f] text-white text-[13px] font-semibold rounded-full hover:bg-[#c02b23] transition-colors shadow-sm"
              >
                Project Dashboard
                <span className="ml-2 text-[16px]" aria-hidden>
                  →
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#efddc8] px-6 sm:px-10 pt-8 pb-7 text-center">
          {/* Icon row */}
          <div className="flex items-center justify-center gap-5 mb-6">
            <span className="w-9 h-9 rounded-full bg-[#f6e9db] flex items-center justify-center text-[#9c8b73]">
              {/* globe icon */}
              <span className="text-xs">🌐</span>
            </span>
            <span className="w-9 h-9 rounded-full bg-[#f6e9db] flex items-center justify-center text-[#9c8b73]">
              {/* email icon */}
              <span className="text-xs">✉</span>
            </span>
            <span className="w-9 h-9 rounded-full bg-[#f6e9db] flex items-center justify-center text-[#9c8b73]">
              {/* phone icon */}
              <span className="text-xs">☎</span>
            </span>
          </div>

          {/* Address + contact */}
          <p className="text-[11px] tracking-[0.16em] uppercase text-[#8b7660] mb-1">
            © 2024 HUB INTERIOR DESIGN STUDIO
          </p>
          <p className="text-[11px] tracking-[0.08em] uppercase text-[#8b7660] mb-1">
            123 DESIGN AVENUE, SUITE 500
          </p>
          <p className="text-[11px] tracking-[0.08em] uppercase text-[#8b7660] mb-4">
            HUBINTERIOR.COM | CONTACT@HUBINTERIOR.COM
          </p>

          {/* Legal line */}
          <p className="text-[10px] tracking-[0.12em] uppercase text-[#b1997f] mb-1">
            This email was sent to you regarding your project with HUB Interior.
          </p>
          <p className="text-[10px] tracking-[0.12em] uppercase text-[#b1997f]">
            Manage email preferences
          </p>
        </div>
      </div>
    </div>
  );
}

