/**
 * DQC 1 - Design Freeze Meeting Summary (MOM + Next Steps)
 * Trigger: Design finalisation meeting completed (submit 3D views + checklist + estimate)
 * Connected to: DQC 1 milestone, task "meeting completed – automated mail: DESIGN FREEZE MOM + NEXT STEP"
 * Mail UI ref: screen5.png (Design Freeze – Meeting Summary)
 *
 * NOTE: This is the base structure only.
 * You will later fine‑tune each part (header band, summary blocks, project info, footer)
 * in 3 passes to match the reference exactly.
 */
export default function Dqc1DesignFreezeMeetingSummaryPage() {
  const designerName = '[Designer Name]';
  const meetingDate = 'Tuesday, October 24, 2023';

  return (
    <div className="min-h-screen bg-[#f3e5d8] py-10 px-4">
      <div className="max-w-[640px] mx-auto bg-white rounded-[26px] shadow-md overflow-hidden">
        {/* ========= PART 1: Brand, hero header, greeting ========= */}
        {/* Brand bar */}
        <div className="bg-[#f5e7d6] px-8 pt-7 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#d62323] rounded-[8px] flex items-center justify-center">
              <span className="text-white font-bold text-xs">HI</span>
            </div>
            <p className="text-[15px] font-semibold text-[#111827] tracking-tight">
              HUB Interior Design
            </p>
          </div>
        </div>

        {/* Hero panel with title + subtitle */}
        <div className="px-8 pt-9 pb-8 bg-gradient-to-b from-[#5d5853] via-[#5b5651] to-[#4b4540] text-white">
          <h1 className="text-[24px] leading-[1.3] font-semibold mb-1">
            Design Freeze – Meeting Summary
          </h1>
          <p className="text-[13px] leading-[1.7] text-[#f7e9d8] max-w-[420px]">
            Solidifying your vision into reality. Thank you for your continued trust
            in HUB.
          </p>
        </div>

        {/* Dear + intro paragraph */}
        <div className="px-8 pt-7 pb-6 bg-white">
          <p className="text-[13px] text-[#4b4b4b] leading-[1.7] mb-3">
            Dear Client,
          </p>
          <p className="text-[13px] text-[#4b4b4b] leading-[1.7]">
            It was a pleasure meeting with you to finalize the design details. This
            summary outlines the core alignments reached during our Design Freeze
            discussion and the path forward for your project.
          </p>
        </div>

        {/* ========= PART 2: Summary cards – Decisions, Action Items, Project Info ========= */}
        <div className="px-8 pb-8 bg-[#fdf7f0] space-y-6">
          {/* Key Decisions / Design Overview */}
          <section className="bg-[#f8efdf] rounded-[16px] px-5 py-5 shadow-[0_6px_18px_rgba(0,0,0,0.03)]">
            <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold mb-3">
              Key Design Decisions
            </p>
            <ul className="space-y-2 text-[13px] leading-[1.7] text-[#3b3b3b]">
              <li className="flex items-start gap-3">
                <span className="mt-[6px] w-2 h-2 rounded-full bg-[#d62323]" />
                <span>Final layout for living, dining and kitchen confirmed.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-[6px] w-2 h-2 rounded-full bg-[#d62323]" />
                <span>Material palette and finishes frozen for all primary spaces.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-[6px] w-2 h-2 rounded-full bg-[#d62323]" />
                <span>Loose furniture and décor direction aligned with the 3D views.</span>
              </li>
            </ul>
          </section>

          {/* Action items / next steps */}
          <section className="bg-[#f8efdf] rounded-[16px] px-5 py-5 shadow-[0_6px_18px_rgba(0,0,0,0.03)]">
            <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold mb-3">
              Action Items &amp; Next Steps
            </p>
            <ul className="space-y-2 text-[13px] leading-[1.7] text-[#3b3b3b]">
              <li className="flex items-start gap-3">
                <span className="mt-[6px] w-2 h-2 rounded-full bg-[#d62323]" />
                <span>Share final 3D views and updated estimate document with you.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-[6px] w-2 h-2 rounded-full bg-[#d62323]" />
                <span>Receive your written approval on the attached design set.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-[6px] w-2 h-2 rounded-full bg-[#d62323]" />
                <span>Initiate procurement and production planning after sign‑off.</span>
              </li>
            </ul>
          </section>

          {/* Project snapshot / quick info */}
          <section className="bg-[#f8efdf] rounded-[16px] px-5 py-5 shadow-[0_6px_18px_rgba(0,0,0,0.03)]">
            <p className="text-[12px] tracking-[0.18em] uppercase text-[#2b2b2b] font-semibold mb-3">
              Project Snapshot
            </p>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div className="bg-[#f4e3cf] rounded-[10px] px-4 py-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#9ca3af] mb-1">
                  Meeting Date
                </p>
                <p className="text-[#111827] font-medium">{meetingDate}</p>
              </div>
              <div className="bg-[#f4e3cf] rounded-[10px] px-4 py-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#9ca3af] mb-1">
                  Property Type
                </p>
                <p className="text-[#111827] font-medium">3 BHK Apartment</p>
              </div>
              <div className="bg-[#f4e3cf] rounded-[10px] px-4 py-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#9ca3af] mb-1">
                  Project ID
                </p>
                <p className="text-[#111827] font-medium">HUB‑2024‑DF‑0921</p>
              </div>
              <div className="bg-[#f4e3cf] rounded-[10px] px-4 py-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#9ca3af] mb-1">
                  Estimate Version
                </p>
                <p className="text-[#111827] font-medium">R2 – Design Freeze</p>
              </div>
            </div>
          </section>
        </div>

        {/* ========= PART 3: CTA + signature + tiny footer ========= */}
        <div className="px-8 pt-6 pb-9 bg-white">
          {/* CTA */}
          <div className="text-center mb-6">
            <button
              type="button"
              className="inline-flex items-center justify-center px-9 py-3 bg-[#d62323] text-white text-[14px] font-semibold rounded-[999px] shadow-[0_10px_20px_rgba(214,35,35,0.35)] hover:bg-[#b51d1d] transition-colors"
            >
              Confirm Approval to Proceed
            </button>
          </div>

          {/* Signature */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#e5e7eb]" />
            <div className="text-[12px] text-[#4b5563]">
              <p className="font-semibold text-[#111827]">{designerName}</p>
              <p className="text-[11px] text-[#d62323]">Lead Interior Designer</p>
            </div>
          </div>

          {/* Mini footer */}
          <p className="text-[10px] tracking-[0.16em] uppercase text-[#b3b3b3] text-center">
            You&apos;re receiving this update as part of your active project with HUB Interior.
          </p>
        </div>
      </div>
    </div>
  );
}

