"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { MeetingWizDurationBadge } from "./MeetingWizTimer";

type Props = {
  onNext: () => void;
  onPrev: () => void;
};

function CompanyProfileModal({ onClose }: { onClose: () => void }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Use local ppt-viewer.html — works on localhost, no external dependency
    setViewerUrl(`/ppt-viewer.html`);

    // Close on Escape key
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const toggleFullscreen = () => setIsFullscreen((f) => !f);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(15,15,35,0.6)", backdropFilter: "blur(4px)" }}
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal panel */}
      <div
        ref={modalRef}
        className="relative flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          width: isFullscreen ? "100vw" : "min(92vw, 1200px)",
          height: isFullscreen ? "100vh" : "min(90vh, 760px)",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 25px 80px rgba(0,0,0,0.25)",
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
          zIndex: 51,
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ background: "#32261C", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-3">
            {/* PPT icon */}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: "rgba(239,1,1,0.15)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF0101" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Company Profile</p>
              <p className="text-sm font-bold text-white leading-tight">HUB PROFILE — Presentation</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download fallback */}
            <a
              href="/hub-profile.pptx"
              download
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
              title="Download PPT"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
            </a>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                </svg>
              )}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-red-500/20 hover:text-red-400"
              title="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading shimmer */}
        {!iframeLoaded && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            style={{ background: "#1a1a2e", zIndex: 10, top: "52px" }}
          >
            <div className="relative">
              <div
                className="h-14 w-14 rounded-full border-4 border-t-transparent animate-spin"
                style={{ borderColor: "#EF0101 transparent #EF0101 #EF0101" }}
              />
            </div>
            <p className="text-sm font-medium text-white/50">Loading Company Profile…</p>
          </div>
        )}

        {/* Iframe viewer */}
        {viewerUrl && (
          <iframe
            src={viewerUrl}
            title="HUB Company Profile"
            className="flex-1 w-full border-0"
            onLoad={() => setIframeLoaded(true)}
            allow="fullscreen"
          />
        )}
      </div>
    </div>
  );
}

export default function AboutHub({ onNext, onPrev }: Props) {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <>
      {showProfile && (
        <CompanyProfileModal onClose={() => setShowProfile(false)} />
      )}
      <main className="min-h-screen w-full bg-[#f0f4f8]">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <MeetingWizDurationBadge />
        <div className="flex items-center gap-4">
          <button
            onClick={onPrev}
            className="text-sm font-medium text-gray-500 transition hover:text-gray-700"
          >
            Previous
          </button>
          <button
            onClick={onNext}
            className="rounded-md bg-[#EF0101] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#EF0101]/90"
          >
            Next Phase
          </button>
          <button className="text-xl font-light text-gray-500 transition hover:text-gray-800">×</button>
        </div>
      </div>
      <div className="flex flex-col items-center py-4">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full ${i < 2 ? "w-8 bg-[#EF0101]" : "w-8 bg-gray-300"}`}
            />
          ))}
        </div>
        <span className="mt-1 text-xs font-medium uppercase tracking-widest text-gray-400">
          Step 2 of 5
        </span>
      </div>

      {/* Page Content */}
      <div className="flex-1 px-8 md:px-12 py-10 max-w-7xl mx-auto w-full box-border">
        <h1 className="text-4xl font-extrabold text-[#111827] mb-2 leading-tight">
          2. About HUB
        </h1>
        <p className="mb-10 text-sm text-gray-500">
          Corporate overview and vision for residential excellence.
        </p>

        {/* Hero Image Collage */}
        <div className="relative mb-10 overflow-hidden rounded-3xl shadow-xl">
          <div className="grid grid-cols-2 grid-rows-2 h-[500px]">
            <div className="relative overflow-hidden group">
              <Image src="/loginPagePic.png" alt="HUB Property 1" fill className="object-cover brightness-[0.6] transition-transform duration-700 group-hover:scale-105" />
            </div>
            <div className="relative overflow-hidden group">
              <Image src="/quote.jpg" alt="HUB Property 2" fill className="object-cover brightness-[0.6] transition-transform duration-700 group-hover:scale-105" />
            </div>
            <div className="relative overflow-hidden group">
              <Image src="/profile1.jpg" alt="HUB Property 3" fill className="object-cover brightness-[0.6] transition-transform duration-700 group-hover:scale-105" />
            </div>
            <div className="relative overflow-hidden group">
              <Image src="/profile2.jpg" alt="HUB Property 4" fill className="object-cover brightness-[0.6] transition-transform duration-700 group-hover:scale-105" />
            </div>
          </div>

          {/* Overlay Card — solid background to prevent image text bleed-through */}
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="w-full max-w-lg rounded-3xl px-10 py-10 text-center shadow-2xl transition-transform hover:scale-[1.02] duration-500"
              style={{ background: "rgba(20, 12, 4, 0.82)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <h2 className="mb-4 text-3xl font-extrabold text-white">
                Building a Legacy of Trust
              </h2>
              <p className="mb-8 text-sm leading-relaxed text-white/85">
                Learn about our mission, legacy, and why clients choose HUB for
                their dream homes. Our presentation covers our end-to-end design
                process and portfolio highlights.
              </p>
              <button
                onClick={() => setShowProfile(true)}
                className="w-full rounded-full bg-[#EF0101] px-8 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-red-500/20 transition-all hover:bg-[#CC0000] hover:shadow-xl hover:-translate-y-0.5"
              >
                Launch Company Profile (PPT)
              </button>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-8 border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#DDCDC1]/20">
              <svg className="h-6 w-6 text-[#EF0101]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h3 className="mb-3 text-lg font-bold text-[#111827]">Our Mission</h3>
            <p className="text-sm leading-relaxed text-gray-500">
              Transforming vision into reality through precision craftsmanship and sustainable innovation.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-8 border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#DDCDC1]/20">
              <svg className="h-6 w-6 text-[#EF0101]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L8 12l4 2 4-2-4-10z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l-4 8M16 12l4 8" />
              </svg>
            </div>
            <h3 className="mb-3 text-lg font-bold text-[#111827]">Expertise</h3>
            <p className="text-sm leading-relaxed text-gray-500">
              A multidisciplinary team of world-class architects, designers, and project managers.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-8 border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#DDCDC1]/20">
              <svg className="h-6 w-6 text-[#EF0101]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h3 className="mb-3 text-lg font-bold text-[#111827]">20+ Year Legacy</h3>
            <p className="text-sm leading-relaxed text-gray-500">
              Over two decades of delivering high-velocity, precision-tracked residential projects.
            </p>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
