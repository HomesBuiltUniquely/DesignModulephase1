/**
 * Milestone: D1 SITE MEASUREMENT (Sl no: 1)
 * Task: Automation mail to CX post closure (Lead Won, closure / form submission)
 * Sheet columns: "D1 SITE MEASUREMENT" → "Automation mail to cx post closure"
 * Related docs:
 * - Closure submit form: https://docs.google.com/document/d/1GS533k7YmrFV8cfs_nRWWTe1trYrQFNpzD4-R9Vys00/edit?usp=sharing
 * - Automation mail content: https://docs.google.com/document/d/1oVkAxfhwpSwjEy6DvpZKOqHNJgsCofkbLs6uOFW47ks/edit?usp=sharing
 *
 * This template is the welcome + journey kickoff email that is triggered
 * once the lead is won and D1 site measurement is initiated.
 */
export default function D1SiteMeasurementMailPage() {
  const customerName = '[Customer Name]';
  const emailAddress = '[Email Address]';
  const contactNumber = '[Contact Number]';

  return (
    <div className="min-h-screen bg-[#f3e5d8] py-12 px-4">
      <div className="max-w-[640px] mx-auto bg-white rounded-[24px] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="pt-10 pb-6 px-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 bg-[#d62323] flex items-center justify-center rounded-md rotate-45">
              <span className="text-white font-bold text-sm -rotate-45">HI</span>
            </div>
            <span className="text-[18px] font-semibold text-black tracking-tight">
              HUB Interior
            </span>
          </div>
          <div className="h-px bg-[#f1e4d2] mb-8" />
          <div className="inline-flex items-center justify-center px-5 py-1 rounded-full bg-[#f6ebdd] text-xs font-semibold tracking-[0.12em] text-[#4c3a26] uppercase mb-6">
            Welcome onboard
          </div>

          {/* Welcome */}
          <h1 className="text-[28px] leading-[36px] font-semibold text-[#111827] mb-3">
            Let&apos;s begin your design journey
          </h1>
          <p className="text-[15px] leading-[24px] text-[#4b5563] mb-10">
            Hi {customerName}, we&apos;re thrilled to start this creative process with
            you. Your dream space is just a few steps away from reality.
          </p>
        </div>

        {/* Main Content */}
        <div className="px-10 pb-10">
          {/* Current Stage */}
          <div className="relative bg-[#f7e4cd] rounded-[18px] p-6 mb-8">
            <div className="absolute top-5 right-6 w-5 h-5 bg-[#d62323] rounded-sm" />
            <p className="text-[11px] font-semibold text-[#d62323] tracking-[0.16em] uppercase mb-1">
              Step 01
            </p>
            <p className="text-[16px] font-semibold text-[#111827] mb-4">
              Current Stage
            </p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
                <span className="text-[17px] font-semibold text-[#111827]">D1</span>
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#111827]">
                  Site Measurement
                </p>
                <p className="text-[13px] leading-[20px] text-[#6b7280] mt-1">
                  Initial verification of your floor plan and dimensions.
                </p>
              </div>
            </div>
          </div>

          {/* Here’s what happens next */}
          <div className="bg-[#f7e4cd] rounded-[18px] p-6 mb-6">
            <p className="text-[16px] font-semibold text-[#111827] mb-4">
              Here&apos;s what happens next
            </p>
            <div className="space-y-4 text-[14px] leading-[22px] text-[#4b5563]">
              <div className="flex items-start gap-3">
                <span className="mt-[5px] w-3 h-3 rounded-full border-[5px] border-[#d62323] bg-[#d62323]" />
                <div>
                  <p className="text-[15px] font-semibold text-[#111827]">
                    Confirm Measurement Slot
                  </p>
                  <p className="text-[13px] leading-[20px] text-[#6b7280]">
                    Select a time for our designer to visit your site.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-[6px] w-3 h-3 rounded-full border border-[#d1d5db]" />
                <div>
                  <p className="text-[15px] font-semibold text-[#111827]">
                    Moodboard Presentation
                  </p>
                  <p className="text-[13px] leading-[20px] text-[#6b7280]">
                    Review initial design directions and material palettes.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-[6px] w-3 h-3 rounded-full border border-[#d1d5db]" />
                <div>
                  <p className="text-[15px] font-semibold text-[#111827]">
                    3D Visualization
                  </p>
                  <p className="text-[13px] leading-[20px] text-[#6b7280]">
                    Experience your home through high-quality renders.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Offer Confirmed */}
          <div className="bg-[#f7e4cd] rounded-[18px] p-6 mb-8">
            <p className="text-[15px] font-semibold text-[#111827] mb-4">
              Offer Confirmed
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-[14px] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af] mb-1">
                  Project ID
                </p>
                <p className="text-[14px] font-semibold text-[#111827]">
                  #HUB-2024-892
                </p>
              </div>
              <div className="bg-white rounded-[14px] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af] mb-1">
                  Property Type
                </p>
                <p className="text-[14px] font-semibold text-[#111827]">
                  4-Room Apartment
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <button
              type="button"
              className="w-full py-4 px-6 bg-[#d62323] text-white text-[15px] font-semibold rounded-full hover:bg-[#b51d1d] transition-colors"
            >
              Confirm Measurement Slot
            </button>
            <p className="text-[13px] text-[#6b7280] mt-4">
              Have questions?{' '}
              <a
                href="#"
                className="text-[#d62323] font-semibold hover:underline"
              >
                Contact your designer
              </a>
              .
            </p>
          </div>
        </div>

        {/* Footer - Email Signature Block */}
        <footer className="px-10 py-8 bg-white border-t border-gray-100">
          <p className="text-[15px] italic text-[#374151] mb-4">
            &ldquo;Designing with intent, living with beauty.&rdquo;
          </p>
          <p className="text-[14px] text-[#374151] mb-1">Warm regards,</p>
          <p className="text-[14px] font-bold text-[#374151] mb-6">
            Team HUB Interior
          </p>
          <div className="space-y-2 text-[13px] text-[#6b7280] mb-6">
            <p className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              123 Design District, Suite 405, Creative City
            </p>
            <p className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              hello@hubinterior.design
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-[#f5f0e8] flex items-center justify-center text-[#6b7280] hover:bg-[#efe9df] transition-colors"
              aria-label="Website"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-[#f5f0e8] flex items-center justify-center text-[#6b7280] hover:bg-[#efe9df] transition-colors"
              aria-label="Portfolio"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
              </svg>
            </a>
          </div>
        </footer>

        {/* Legal - Footer background */}
        <div className="px-10 py-6 bg-[#f8f5ef]">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#9c8b73] text-center mb-1">
            You received this email because you started a project with HUB Interior.
          </p>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#9c8b73] text-center">
            © 2024 HUB INTERIOR. ALL RIGHTS RESERVED.
          </p>
        </div>
      </div>
    </div>
  );
}
