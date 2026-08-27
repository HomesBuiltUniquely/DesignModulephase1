"use client";
import { useMemo, useState } from "react";
import { useAuth } from "@/app/auth/AuthContext";
import {
  MeetingWizShell,
  MeetingWizStepDots,
  MeetingWizTopBar,
  mwCard,
  mwCta,
  mwH1,
  mwMuted,
} from "./MeetingWizChrome";

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
    <MeetingWizShell>
      <MeetingWizTopBar onPrev={onPrev} onNext={onNext} />
      <MeetingWizStepDots current={3} />

      <div className="mx-auto box-border w-full max-w-7xl flex-1 px-8 pb-28 pt-10 md:px-12">
        <h1 className={mwH1}>3. Designer Portfolio</h1>
        <p className={`${mwMuted} mb-10 max-w-2xl`}>
          A curated selection of spaces that define our craft, blending architectural precision with human-centric aesthetics.
        </p>

        <div className={`${mwCard} mb-10 flex flex-wrap gap-12 p-8`}>
          {stats.map((stat) => (
            <div key={stat.label} className="group">
              <p className="mb-1 text-3xl font-extrabold text-[var(--brand-dark)]">{stat.value}</p>
              <p className="whitespace-pre-line text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)]/50 transition-colors group-hover:text-[var(--brand-dark)]">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`cursor-pointer rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                activeTab === tab
                  ? "bg-[var(--brand-dark)] text-[var(--card-bg)] shadow-md hover:-translate-y-0.5"
                  : "border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--foreground)]/65 hover:border-[var(--brand-primary)] hover:text-[var(--brand-dark)] hover:shadow-sm"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className={`${mwCard} p-12 text-center`}>
            <p className="text-sm font-medium text-[var(--foreground)]/65">
              No projects in this category yet. Add them under Profile → Portfolio projects.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((img, idx) => (
              <div key={`${img.src}-${idx}`} className="group relative h-64 cursor-pointer overflow-hidden rounded-2xl bg-[var(--hover-bg)] shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-xl">
                {/* next/image needs known remote domains; profile uploads may be S3/API URLs */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.alt}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                   <p className="text-sm font-bold tracking-wide text-white drop-shadow-md">{img.alt}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-6 left-1/2 z-10 -translate-x-1/2">
        <button type="button" onClick={() => onNext()} className={mwCta}>
          Next: Scope of Project
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white">→</span>
        </button>
      </div>
    </MeetingWizShell>
  );
}
