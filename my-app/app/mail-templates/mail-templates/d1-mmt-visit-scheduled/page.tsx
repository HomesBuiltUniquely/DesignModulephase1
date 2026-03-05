/**
 * D1 for MMT Request - Site Measurement Visit Scheduled
 * Trigger: After picking the date (customer selects MMT slot)
 * Connected to: D1 Site Measurement milestone, task "D1 for MMT request"
 * Mail UI ref: screen (1).png
 */
export default function D1MmtVisitScheduledPage() {
  return (
    <div className="min-h-screen bg-[#f7f4ef] py-12 px-4" style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      <div className="max-w-[640px] mx-auto bg-white rounded-[18px] shadow-sm overflow-hidden">
        {/* ========== PART 1: Upper - Header, Title, Visit Details ========== */}
        <div className="pt-10 pb-8 px-10">
          {/* Logo & Brand */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-11 h-11 bg-[#da4b3a] rounded-[10px] flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <p className="text-[17px] font-bold tracking-[0.12em] text-[#333333] uppercase">
              HUB Interior
            </p>
          </div>

          {/* CONFIRMATION pill */}
          <div className="flex justify-center mb-6">
            <span className="inline-block px-5 py-1.5 bg-[#fbe3df] rounded-full text-[11px] font-bold tracking-wider text-[#da4b3a] uppercase">
              Confirmation
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-[30px] leading-[38px] font-bold text-[#333333] text-center mb-4">
            Site Measurement Visit Scheduled
          </h1>
          <p className="text-[15px] leading-[24px] text-[#555555] text-center max-w-[520px] mx-auto mb-8">
            Your upcoming site audit for the interior project has been
            successfully confirmed. Please find the details of our visit below.
          </p>

          {/* VISIT DETAILS Card */}
          <div className="bg-[#f8f8f8] rounded-[18px] p-6 mb-6">
            <div className="flex items-center gap-2 mb-5">
              <svg className="w-5 h-5 text-[#da4b3a] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p className="text-[14px] font-bold tracking-[0.1em] text-[#333333] uppercase">
                Visit Details
              </p>
            </div>
            <div className="space-y-4 text-[15px]">
              <div className="flex justify-between items-center">
                <span className="text-[#555555] font-normal">Date</span>
                <span className="font-bold text-[#333333]">October 24, 2023</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#555555] font-normal">Time</span>
                <span className="font-bold text-[#333333]">10:00 AM - 12:00 PM</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-[#555555] font-normal">Measurement Executive</span>
                <div className="text-right">
                  <p className="font-bold text-[#333333]">Rahul Sharma</p>
                  <p className="text-[13px] text-[#777777] font-normal mt-0.5">+91 98765 43210</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========== PART 2: Middle - Please Note, CTA, Image, Closing ========== */}
        <div className="px-10 pb-10">

          {/* PLEASE NOTE */}
          <div className="bg-white rounded-[18px] p-6 mb-8 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-5 h-5 rounded-full bg-[#da4b3a] flex items-center justify-center text-white text-[10px] font-bold shrink-0">i</span>
              <p className="text-[14px] font-bold tracking-[0.1em] text-[#333333] uppercase">
                Please Note
              </p>
            </div>
            <ul className="space-y-3 pl-0">
              {[
                "Ensure site access and keys are ready at the scheduled time.",
                "Electricity availability is required for high-precision laser measurements.",
                "Arrange necessary gate permissions or visitor passes prior to the visit.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-[#da4b3a] rounded-full mt-1.5 shrink-0" />
                  <span className="text-[15px] text-[#555555]">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA Button & Link */}
          <div className="text-center mb-8">
            <button
              type="button"
              className="w-full py-4 px-6 bg-[#da4b3a] text-white text-[14px] font-bold tracking-wider uppercase rounded-xl hover:bg-[#b51d1d] transition-colors"
            >
              Share Access Instructions
            </button>
            <p className="text-[13px] text-[#6b7280] mt-4">
              Need to reschedule?{' '}
              <a href="#" className="text-[#6b7280] underline hover:text-[#da4b3a]">
                Click here
              </a>
            </p>
          </div>

          {/* Image Banner */}
          <div className="w-full h-[220px] bg-[#f5f0e8] rounded-[18px] overflow-hidden mb-10 flex items-center justify-center">
            <div className="text-[#9ca3af] text-sm">[Wooden desk, blueprints, mug, office chair]</div>
          </div>

          {/* Closing Salutation */}
          <div className="text-center">
            <p className="text-[14px] text-[#374151] mb-1">Warmly,</p>
            <p className="text-[15px] font-bold text-[#111827]">Team HUB Interior</p>
          </div>
        </div>

        {/* ========== PART 3: Lower - Footer ========== */}
        <footer className="px-10 py-8 bg-[#f7f4ef] text-center">
          <p className="text-[13px] text-[#6b7280] mb-1">
            Contact us: support@hubinterior.com | +91 (80) 1234-5678
          </p>
          <p className="text-[13px] text-[#6b7280] mb-6">
            123 Design District, High-Rise Blvd, Metro City
          </p>
          <div className="pt-4 border-t border-gray-200">
            <p className="text-[10px] text-[#9ca3af]">
              INTERNAL REF: SITE-AUDIT-2023-OCT-24 | CC: OPS-TEAM
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
