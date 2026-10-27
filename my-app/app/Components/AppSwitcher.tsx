"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/apiBase";

type HallwayUser = { email?: string | null; name?: string | null; role?: string | null };

type Props = {
  hallwayUrl: string;
  hallwayUser?: HallwayUser | null;
  hallwaySessionId?: string | null;
  showAdmin: boolean;
};

function hallwayHomeTarget(base: string, user?: HallwayUser | null, sessionId?: string | null) {
  const url = new URL(base);
  url.pathname = "/";
  url.search = "";
  if (sessionId && user?.email) {
    url.hash = `hub=${encodeURIComponent(
      JSON.stringify({
        sessionId,
        email: user.email,
        name: user.name || "",
        role: user.role || "",
        apiBase: getApiBase(),
      }),
    )}`;
  } else {
    url.hash = "";
  }
  return url.toString();
}

function FourSquareIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="3.5" fill="currentColor" />
      <rect x="18" y="2" width="12" height="12" rx="3.5" fill="currentColor" />
      <rect x="2" y="18" width="12" height="12" rx="3.5" fill="currentColor" />
      <rect x="18" y="18" width="12" height="12" rx="3.5" fill="currentColor" />
    </svg>
  );
}

const tileClass =
  "group relative grid h-11 w-11 shrink-0 place-items-center rounded-[13px] text-[var(--brand-primary)] transition hover:scale-105 hover:bg-[var(--hover-bg)]";

function SwitcherGlyph({ src }: { src: string }) {
  return (
    <span
      aria-hidden
      className="block h-7 w-7 bg-current"
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
}

export default function AppSwitcher({
  hallwayUrl,
  hallwayUser,
  hallwaySessionId,
  showAdmin,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Open app switcher"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`grid h-9 w-9 place-items-center rounded-xl text-[var(--brand-primary)] transition hover:bg-[var(--hover-bg)] ${
          open ? "scale-110 bg-[var(--hover-bg)]" : ""
        }`}
      >
        <FourSquareIcon />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-max rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] px-2 py-1.5 text-[var(--foreground)] shadow-xl">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title="Hallway"
              aria-label="Hallway"
              className={tileClass}
              onClick={() => {
                setOpen(false);
                window.open(hallwayHomeTarget(hallwayUrl, hallwayUser, hallwaySessionId), "_blank", "noopener");
              }}
            >
              <SwitcherGlyph src="/icons/switcher-hallway.png" />
            </button>
            {showAdmin ? (
              <Link
                href="/admin"
                title="Admin"
                aria-label="Admin"
                className={tileClass}
                onClick={() => setOpen(false)}
              >
                <SwitcherGlyph src="/icons/switcher-admin.png?v=2" />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
