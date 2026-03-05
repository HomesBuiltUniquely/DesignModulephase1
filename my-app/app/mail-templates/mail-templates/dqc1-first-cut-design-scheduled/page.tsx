/**
 * DQC 1 - First Cut Design + Quotation Discussion Meeting Request
 * Trigger: Submit form with date of meeting + upload files
 * Connected to: DQC 1 milestone, task "First cut design + quotation discussion meeting request"
 * Mail UI ref: screen (2).png
 */
export default function Dqc1FirstCutDesignScheduledPage() {
  const customerName = '[Customer Name]';

  return (
    <div className="min-h-screen bg-[#f8f5ee] py-12 px-4">
      <div className="max-w-[640px] mx-auto bg-white rounded-[24px] shadow-md overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        {/* ========== PART 1: Upper - Header, Title, Greeting, Image, Meeting Details ========== */}
        <div className="pt-12 pb-10 px-8">
          {/* Logo & Brand - red triangle with white crescent upper-left, HUB INTERIOR regular, two lines */}
          <div className="flex items-center justify-center gap-3 mb-[15px]">
            <div className="w-9 h-10 shrink-0 flex items-center">
              <svg className="w-9 h-10" viewBox="0 0 36 40" fill="none" aria-hidden>
                <path d="M18 0L36 40H0L18 0Z" fill="#da4b3a" />
                <path d="M10 6 Q22 4 30 14 Q18 20 10 6Z" fill="white" />
              </svg>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-[16px] font-normal tracking-[0.08em] text-[#333333] uppercase leading-none" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                HUB Interior
              </p>
              <div className="h-px bg-[#d4d4d4] w-[70px] mt-2 mx-auto" />
            </div>
          </div>

          {/* Spacing below logo */}
          <div className="mb-[35px]" />

          {/* Main Title - 28-32px extrabold/black, tight line-height */}
          <h1 className="text-[30px] leading-[1.15] font-extrabold text-black text-center mb-5 max-w-[480px] mx-auto">
            First Cut Design Discussion Scheduled
          </h1>

          {/* Body - 16-18px regular dark gray, ~25px below */}
          <p className="text-[17px] leading-[1.5] font-normal text-[#4a4a4a] text-center max-w-[480px] mx-auto mb-7">
            Hi {customerName}, we are excited to share the initial design
            concepts for your space. Let&apos;s review the vision together.
          </p>

          {/* Image Block - 8-12px radius, ~35px below */}
          <div className="w-full h-[220px] bg-[#e8e0d0] rounded-xl overflow-hidden shadow-sm flex items-center justify-center mb-9">
            <div className="text-[#9ca3af] text-sm">[Leafy green plant on beige background]</div>
          </div>

          {/* Meeting Details Panel - light beige, padding 18px 28px */}
          <div className="bg-[#f5f2eb] rounded-[20px] px-7 py-5 shadow-sm">
            <div className="flex justify-between items-center py-4 border-b border-[#e0e0e0]">
              <span className="text-[13px] font-normal tracking-[0.1em] text-[#9ca3af] uppercase">
                Date
              </span>
              <span className="text-[17px] font-normal text-black">
                October 24, 2023
              </span>
            </div>
            <div className="flex justify-between items-center py-4">
              <span className="text-[13px] font-normal tracking-[0.1em] text-[#9ca3af] uppercase">
                Time
              </span>
              <span className="text-[17px] font-normal text-black">
                2:00 PM — 3:00 PM (EST)
              </span>
            </div>
          </div>
        </div>

        {/* ========== PART 2: Note, CTA, Signature, Contact, Disclaimer, Copyright ========== */}
        <div className="px-8 pb-0">
          {/* Meeting message - 14-16px regular, dark grey, red circle icon 8-10px */}
          <div className="flex items-start gap-3 mb-8">
            <span className="w-[9px] h-[9px] rounded-full bg-[#da4b3a] flex items-center justify-center shrink-0 mt-1.5">
              <span className="w-1 h-1 rounded-full bg-white" />
            </span>
            <p className="text-[15px] font-normal text-[#333333] leading-relaxed">
              The virtual meeting link will be sent automatically to your
              calendar once you confirm the time below.
            </p>
          </div>

          {/* CTA Buttons - Bold 16-18px, 10-15px between button and link */}
          <div className="text-center mb-10">
            <button
              type="button"
              className="w-full py-4 px-8 bg-[#da4b3a] text-white text-[17px] font-bold rounded-lg hover:bg-[#b51d1d] transition-colors mb-4"
            >
              Confirm This Time
            </button>
            <a
              href="#"
              className="text-[15px] text-[#da4b3a] font-normal underline hover:no-underline"
            >
              Request a different time
            </a>
          </div>

          {/* Separator */}
          <div className="h-px bg-[#e5e5e5] mb-8" />

          {/* Signature Block - profile 40-45px, name bold 16-18px, title regular 12-14px */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-11 h-11 rounded-full bg-gray-300 shrink-0" />
            <div>
              <p className="text-[17px] font-bold text-[#1f1f1f] leading-tight">
                Best, Sarah Mitchell
              </p>
              <p className="text-[13px] font-normal tracking-[0.08em] text-[#9ca3af] uppercase mt-0.5">
                Lead Designer, HUB Interior
              </p>
            </div>
          </div>

          {/* Contact Info - 12-14px light grey, icons 12-14px */}
          <div className="flex flex-wrap gap-6 mb-6 text-[13px] text-[#9ca3af]">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-[#9ca3af]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
              hubinterior.com
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-[#9ca3af]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              hello@hubinterior.com
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-[#9ca3af]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              New York, NY
            </span>
          </div>

          {/* Disclaimer - 10-12px light grey */}
          <p className="text-[11px] font-normal text-[#9ca3af] leading-relaxed mb-6">
            You&apos;re receiving this because you&apos;ve engaged with Hub
            Interior for your project. To manage your communication
            preferences, please visit your client portal.
          </p>
        </div>

        {/* Copyright footer - darker warm beige bg, 10-12px centered */}
        <div className="bg-[#f0ebe3] rounded-b-[24px] px-8 py-6">
          <p className="text-[11px] font-normal text-[#9ca3af] text-center">
            © 2023 HUB Interior Design Studio. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
