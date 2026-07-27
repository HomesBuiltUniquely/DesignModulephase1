
"use client";
import Image from "next/image";
import { useState } from "react";

const TABS = ["ALL PROJECTS", "LIVING ROOM", "BEDROOM", "KITCHEN"];

const ALL_IMAGES = [
  { src: "/A. Light-toned Scandinavian kitchen.png", alt: "Scandinavian Kitchen", category: "KITCHEN" },
  { src: "/A. Cozy Scandinavian bedroom.png", alt: "Scandinavian Bedroom", category: "BEDROOM" },
  { src: "/F. Modern contemporary kitchen with clean lines.png", alt: "Modern Kitchen", category: "KITCHEN" },
  { src: "/B. Soft pastel European Classic bedroom.png", alt: "European Bedroom", category: "BEDROOM" },
  { src: "/B. Classic chandeliers.png", alt: "Classic Dining Room", category: "LIVING ROOM" },
  { src: "/G. Minimalistic all-neutral bathroom.png", alt: "Minimalistic Bathroom", category: "LIVING ROOM" },
  { src: "/F. Modern clean-lined patio.png", alt: "Modern Patio", category: "LIVING ROOM" },
  { src: "/F. Clean-lined modern contemporary bedroom.png", alt: "Modern Bedroom", category: "BEDROOM" },
  { src: "/A. A soft oak Scandinavian lounge chair.png", alt: "Scandinavian Lounge", category: "LIVING ROOM" },
];

// Scope view removed per request

type Props = { onPrev: () => void; onNext: () => void };

export default function DesignPort({ onPrev, onNext }: Props) {
  const [activeTab, setActiveTab] = useState("ALL PROJECTS");
  // Only portfolio view is needed now
  const view = "portfolio" as const;

  const filtered = activeTab === "ALL PROJECTS"
    ? ALL_IMAGES
    : ALL_IMAGES.filter((img) => img.category === activeTab);

  // Scope of work view removed intentionally

  // ─── PORTFOLIO VIEW ───────────────────────────────────────────────
  return (
    <>
      <main className="min-h-screen w-full bg-[#f0f4f8]">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-gray-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Duration:</span>
          <span className="text-sm font-bold text-gray-900">00:27:46</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onPrev} className="text-sm font-medium text-gray-500 transition hover:text-gray-700">
            Previous
          </button>
          <button onClick={onNext} className="rounded-md bg-[#2EE86B] px-6 py-2 text-sm font-semibold text-black transition hover:bg-[#24d45d]">
            Next Phase
          </button>
          <button className="text-xl font-light text-gray-500 transition hover:text-gray-800">×</button>
        </div>
      </div>

      {/* Step Progress Dots */}
      <div className="flex flex-col items-center py-4">
        <div className="flex items-center gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={`h-1 rounded-full w-8 ${i < 3 ? "bg-[#2EE86B]" : "bg-gray-300"}`} />
          ))}
        </div>
        <span className="mt-1 text-xs font-medium uppercase tracking-widest text-gray-400">
          Step 3 of 9
        </span>
      </div>

      <div className="mx-auto max-w-4xl px-6 pb-28">
        <h1 className="mb-1 text-3xl font-extrabold text-gray-900">3. Designer portfolio</h1>
        <p className="mb-6 text-sm text-gray-500 max-w-lg">
          A curated selection of spaces that define our craft, blending architectural precision with human-centric aesthetics.
        </p>

        {/* Stats Row */}
        <div className="mb-6 flex flex-wrap gap-8">
          {[
            { value: "140+", label: "PROJECTS\nCOMPLETED" },
            { value: "250k+", label: "SQ. FT. DESIGNED" },
            { value: "12", label: "AWARDS WON" },
            { value: "4.9/5", label: "CLIENT\nSATISFACTION" },
          ].map((stat) => (
            <div key={stat.value}>
              <p className="text-2xl font-extrabold text-gray-900">{stat.value}</p>
              <p className="whitespace-pre-line text-[10px] font-semibold uppercase tracking-widest text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex items-center gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                activeTab === tab ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Image Grid */}
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((img, idx) => (
            <div key={idx} className="relative h-48 overflow-hidden rounded-xl bg-gray-100">
              <Image src={img.src} alt={img.alt} fill className="object-cover transition duration-300 hover:scale-105" />
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Bottom CTA: preserved for future next-phase navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
        <button
          onClick={() => onNext()}
          className="flex items-center gap-3 rounded-full bg-[#2EE86B] px-8 py-4 text-sm font-bold uppercase tracking-widest text-gray-900 shadow-lg transition hover:bg-[#24d45d]"
        >
          Next: Scope of Project
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white">→</span>
        </button>
      </div>
    </main>
    </>
  );
}
