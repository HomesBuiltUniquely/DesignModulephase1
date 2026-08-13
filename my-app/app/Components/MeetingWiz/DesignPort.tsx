"use client";
import { useMemo, useState } from "react";
import { useAuth } from "@/app/auth/AuthContext";
import { MeetingWizDurationBadge } from "./MeetingWizTimer";

const TABS = ["ALL PROJECTS", "LIVING ROOM", "BEDROOM", "KITCHEN"] as const;

const FALLBACK_IMAGES = [
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

type Props = { onPrev: () => void; onNext: () => void };

export default function DesignPort({ onPrev, onNext }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("ALL PROJECTS");

  const portfolioImages = useMemo(() => {
    const fromProfile = Array.isArray(user?.designerInspirationProjects)
      ? user.designerInspirationProjects
          .filter((p) => p?.imageUrl)
          .map((p) => ({
            src: String(p.imageUrl),
            alt: String(p.title || "Portfolio project"),
            category: String(p.category || "OTHER").toUpperCase(),
          }))
      : [];
    return fromProfile.length ? fromProfile : FALLBACK_IMAGES;
  }, [user?.designerInspirationProjects]);

  const usingProfileGallery =
    Array.isArray(user?.designerInspirationProjects) &&
    user.designerInspirationProjects.some((p) => Boolean(p?.imageUrl));

  const filtered =
    activeTab === "ALL PROJECTS"
      ? portfolioImages
      : portfolioImages.filter((img) => img.category === activeTab);

  const stats = [
    {
      value: user?.designerProjects?.trim() || (usingProfileGallery ? "—" : "140+"),
      label: "PROJECTS\nCOMPLETED",
    },
    {
      value: user?.designerSqft?.trim() || (usingProfileGallery ? "—" : "250k+"),
      label: "SQ. FT. DESIGNED",
    },
    {
      value: user?.designerAwards?.trim() || (usingProfileGallery ? "—" : "12"),
      label: "AWARDS WON",
    },
    {
      value: user?.designerSatisfaction?.trim() || (usingProfileGallery ? "—" : "4.9/5"),
      label: "CLIENT\nSATISFACTION",
    },
  ];

  return (
    <>
      <main className="min-h-screen w-full bg-[#f0f4f8]">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <MeetingWizDurationBadge />
        <div className="flex items-center gap-4">
          <button onClick={onPrev} className="text-sm font-medium text-gray-500 transition hover:text-gray-700">
            Previous
          </button>
          <button onClick={onNext} className="rounded-md bg-[#EF0101] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#EF0101]/90">
            Next Phase
          </button>
          <button className="text-xl font-light text-gray-500 transition hover:text-gray-800">×</button>
        </div>
      </div>

      <div className="flex flex-col items-center py-4">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-1 rounded-full w-8 ${i < 3 ? "bg-[#EF0101]" : "bg-gray-300"}`} />
          ))}
        </div>
        <span className="mt-1 text-xs font-medium uppercase tracking-widest text-gray-400">
          Step 3 of 5
        </span>
      </div>

      <div className="flex-1 px-8 md:px-12 py-10 max-w-7xl mx-auto w-full box-border pb-28">
        <h1 className="text-4xl font-extrabold text-[#111827] mb-2 leading-tight">3. Designer Portfolio</h1>
        <p className="mb-10 text-sm text-gray-500 max-w-2xl">
          A curated selection of spaces that define our craft, blending architectural precision with human-centric aesthetics.
        </p>

        <div className="mb-10 flex flex-wrap gap-12 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          {stats.map((stat) => (
            <div key={stat.label} className="group">
              <p className="text-3xl font-extrabold text-[#111827] mb-1">{stat.value}</p>
              <p className="whitespace-pre-line text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mb-8 flex items-center gap-3 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                activeTab === tab ? "bg-[#111827] text-white shadow-md hover:-translate-y-0.5" : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-800 hover:shadow-sm"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              No projects in this category yet. Add them under Profile → Portfolio projects.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((img, idx) => (
              <div key={`${img.src}-${idx}`} className="relative h-64 overflow-hidden rounded-2xl bg-gray-100 shadow-sm transition-all duration-500 hover:shadow-xl hover:-translate-y-1 group">
                {/* next/image needs known remote domains; profile uploads may be S3/API URLs */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.alt}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                   <p className="text-white font-bold text-sm tracking-wide drop-shadow-md">{img.alt}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
        <button
          onClick={() => onNext()}
          className="flex items-center gap-3 rounded-full bg-[#EF0101] px-8 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-red-500/20 transition-all duration-300 hover:bg-[#CC0000] hover:shadow-xl hover:-translate-y-0.5"
        >
          Next: Scope of Project
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white">→</span>
        </button>
      </div>
    </main>
    </>
  );
}
