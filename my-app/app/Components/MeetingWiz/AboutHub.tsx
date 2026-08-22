"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { MeetingWizShell, MeetingWizStepDots, MeetingWizTopBar } from "./MeetingWizChrome";

type Props = {
  onNext: () => void;
  onPrev: () => void;
};

function CompanyProfileModal({ onClose }: { onClose: () => void }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setViewerUrl(`/ppt-viewer.html`);

    const el = modalRef.current;
    if (el && !document.fullscreenElement) {
      void el.requestFullscreen?.().catch(() => {});
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[400] bg-[var(--card-bg)]">
      <div
        ref={modalRef}
        className="flex h-full w-full flex-col overflow-hidden bg-[var(--card-bg)]"
      >
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] bg-[var(--brand-surface)] px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-secondary)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]/50">Company Profile</p>
              <p className="text-sm font-bold leading-tight text-[var(--brand-dark)]">HUB PROFILE — Presentation</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download fallback */}
            <a
              href="/hub-profile.pptx"
              download
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]/70 transition hover:bg-[var(--hover-bg)] hover:text-[var(--brand-dark)]"
              title="Download PPT"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
            </a>

            {/* Close */}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--foreground)]/70 transition hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-primary)]"
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
            className="absolute inset-x-0 bottom-0 top-[52px] z-10 flex flex-col items-center justify-center gap-4 bg-[var(--card-bg)]"
          >
            <div className="relative">
              <div
                className="h-14 w-14 animate-spin rounded-full border-4"
                style={{ borderColor: "var(--brand-secondary)", borderTopColor: "var(--brand-primary)" }}
              />
            </div>
            <p className="text-sm font-medium text-[var(--foreground)]/50">Loading Company Profile…</p>
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

  const closeProfile = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    setShowProfile(false);
  };

  const openProfileFullscreen = () => {
    const root = document.documentElement;
    void root.requestFullscreen?.().catch(() => {});
    setShowProfile(true);
  };

  return (
    <>
      {showProfile && (
        <CompanyProfileModal onClose={closeProfile} />
      )}
      <MeetingWizShell>
      <MeetingWizTopBar onPrev={onPrev} onNext={onNext} />
      <div className="flex flex-col items-center py-4">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-1 w-8 rounded-full ${i < 2 ? "bg-[var(--brand-primary)]" : "bg-[var(--border-color)]"}`}
            />
          ))}
        </div>
        <span className="mt-1 text-xs font-medium uppercase tracking-widest text-[var(--foreground)]/40">
          Step 2 of 5
        </span>
      </div>

      {/* Page Content */}
      <div className="mx-auto box-border w-full max-w-7xl flex-1 px-8 py-10 md:px-12">
        <h1 className="mb-2 text-4xl font-extrabold leading-tight text-[var(--brand-dark)]">
          2. About HUB
        </h1>
        <p className="mb-10 text-sm text-[var(--foreground)]/55">
          Corporate overview and vision for residential excellence.
        </p>

        {/* Hero Image Collage */}
        <div className="relative mb-10 overflow-hidden rounded-3xl border border-[var(--border-color)] shadow-xl">
          <div className="grid h-[500px] grid-cols-2 grid-rows-2">
            <div className="group relative overflow-hidden">
              <Image src="/loginPagePic.png" alt="HUB Property 1" fill className="object-cover brightness-[0.88] transition-transform duration-700 group-hover:scale-105" />
            </div>
            <div className="group relative overflow-hidden">
              <Image src="/quote.jpg" alt="HUB Property 2" fill className="object-cover brightness-[0.88] transition-transform duration-700 group-hover:scale-105" />
            </div>
            <div className="group relative overflow-hidden">
              <Image src="/profile1.jpg" alt="HUB Property 3" fill className="object-cover brightness-[0.88] transition-transform duration-700 group-hover:scale-105" />
            </div>
            <div className="group relative overflow-hidden">
              <Image src="/profile2.jpg" alt="HUB Property 4" fill className="object-cover brightness-[0.88] transition-transform duration-700 group-hover:scale-105" />
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center bg-black/20 p-6">
            <div className="w-full max-w-lg rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)]/92 px-10 py-10 text-center shadow-xl backdrop-blur-md transition-transform duration-500 hover:scale-[1.02]">
              <h2 className="mb-4 text-3xl font-extrabold text-[var(--brand-dark)]">
                Building a Legacy of Trust
              </h2>
              <p className="mb-8 text-sm leading-relaxed text-[var(--foreground)]/70">
                Learn about our mission, legacy, and why clients choose HUB for
                their dream homes. Our presentation covers our end-to-end design
                process and portfolio highlights.
              </p>
              <button
                onClick={openProfileFullscreen}
                className="cursor-pointer rounded-xl bg-[var(--brand-dark)] px-8 py-3.5 text-sm font-semibold tracking-wide text-[var(--card-bg)] shadow-sm transition-all hover:-translate-y-0.5 hover:opacity-90"
              >
                Launch Company Profile (PPT)
              </button>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-secondary)]/30">
              <svg className="h-6 w-6 text-[var(--brand-primary)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h3 className="mb-3 text-lg font-bold text-[var(--brand-dark)]">Our Mission</h3>
            <p className="text-sm leading-relaxed text-[var(--foreground)]/55">
              Transforming vision into reality through precision craftsmanship and sustainable innovation.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-secondary)]/30">
              <svg className="h-6 w-6 text-[var(--brand-primary)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L8 12l4 2 4-2-4-10z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l-4 8M16 12l4 8" />
              </svg>
            </div>
            <h3 className="mb-3 text-lg font-bold text-[var(--brand-dark)]">Expertise</h3>
            <p className="text-sm leading-relaxed text-[var(--foreground)]/55">
              A multidisciplinary team of world-class architects, designers, and project managers.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-secondary)]/30">
              <svg className="h-6 w-6 text-[var(--brand-primary)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h3 className="mb-3 text-lg font-bold text-[var(--brand-dark)]">20+ Year Legacy</h3>
            <p className="text-sm leading-relaxed text-[var(--foreground)]/55">
              Over two decades of delivering high-velocity, precision-tracked residential projects.
            </p>
          </div>
        </div>
      </div>
    </MeetingWizShell>
    </>
  );
}
