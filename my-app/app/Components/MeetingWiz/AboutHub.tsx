"use client";

import Image from "next/image";
import { MeetingWizDurationBadge } from "./MeetingWizTimer";

type Props = {
  onNext: () => void;
  onPrev: () => void;
};

export default function AboutHub({ onNext, onPrev }: Props) {
  return (
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
            className="rounded-md bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90"
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
              className={`h-1 rounded-full ${i < 2 ? "w-8 bg-[var(--brand-primary)]" : "w-8 bg-gray-300"}`}
            />
          ))}
        </div>
        <span className="mt-1 text-xs font-medium uppercase tracking-widest text-gray-400">
          Step 2 of 5
        </span>
      </div>

      {/* Page Content */}
      <div className="mx-auto max-w-4xl px-6 pb-10">
        <h1 className="mb-1 text-3xl font-extrabold text-gray-900">
          2. About HUB
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Corporate overview and vision for residential excellence.
        </p>

        {/* Hero Image Collage */}
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <div className="grid grid-cols-2 grid-rows-2 h-[380px]">
            <div className="relative overflow-hidden">
              <Image src="/loginPagePic.png" alt="HUB Property 1" fill className="object-cover brightness-75" />
            </div>
            <div className="relative overflow-hidden">
              <Image src="/quote.jpg" alt="HUB Property 2" fill className="object-cover brightness-75" />
            </div>
            <div className="relative overflow-hidden">
              <Image src="/profile1.jpg" alt="HUB Property 3" fill className="object-cover brightness-75" />
            </div>
            <div className="relative overflow-hidden">
              <Image src="/profile2.jpg" alt="HUB Property 4" fill className="object-cover brightness-75" />
            </div>
          </div>

          {/* Glass Overlay Card */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="mx-6 w-full max-w-md rounded-2xl bg-white/20 px-8 py-8 text-center backdrop-blur-md border border-white/30 shadow-lg">
              <h2 className="mb-3 text-2xl font-bold text-white drop-shadow">
                Building a Legacy of Trust
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-white/90 drop-shadow">
                Learn about our mission, legacy, and why clients choose HUB for
                their dream homes. Our presentation covers our end-to-end design
                process and portfolio highlights.
              </p>
              <button className="w-full rounded-full bg-[var(--brand-primary)] px-6 py-3 text-sm font-bold text-white transition hover:opacity-90">
                Launch Company Profile (PPT)
              </button>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-green-50">
              <svg className="h-5 w-5 text-[var(--brand-primary)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Our Mission</h3>
            <p className="text-sm leading-relaxed text-gray-500">
              Transforming vision into reality through precision craftsmanship and sustainable innovation.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-green-50">
              <svg className="h-5 w-5 text-[var(--brand-primary)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L8 12l4 2 4-2-4-10z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l-4 8M16 12l4 8" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Expertise</h3>
            <p className="text-sm leading-relaxed text-gray-500">
              A multidisciplinary team of world-class architects, designers, and project managers.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-green-50">
              <svg className="h-5 w-5 text-[var(--brand-primary)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">20+ Year Legacy</h3>
            <p className="text-sm leading-relaxed text-gray-500">
              Over two decades of delivering high-velocity, precision-tracked residential projects.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
