"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/apiBase";

type LinkItem = { href: string; label: string };

type HallwayUser = { email?: string | null; name?: string | null; role?: string | null };

type Props = {
  hallwayUrl: string;
  hallwayUser?: HallwayUser | null;
  hallwaySessionId?: string | null;
  financeLinks: LinkItem[];
  operationLinks: LinkItem[];
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
  financeLinks,
  operationLinks,
  showAdmin,
}: Props) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<"finance" | "operations" | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSection(null);
        setListOpen(true);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setSection(null);
        setListOpen(true);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const list = section === "finance" ? financeLinks : section === "operations" ? operationLinks : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Open app switcher"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          setSection(null);
          setListOpen(true);
        }}
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
            {financeLinks.length > 0 ? (
              <button
                type="button"
                title="Finance"
                aria-label="Finance"
                aria-pressed={section === "finance"}
                className={tileClass}
                onClick={() => {
                  if (section === "finance") {
                    setListOpen((value) => !value);
                    return;
                  }
                  setSection("finance");
                  setListOpen(true);
                }}
              >
                <SwitcherGlyph src="/icons/switcher-finance.png?v=2" />
              </button>
            ) : null}
            {operationLinks.length > 0 ? (
              <button
                type="button"
                title="Operations"
                aria-label="Operations"
                aria-pressed={section === "operations"}
                className={tileClass}
                onClick={() => {
                  if (section === "operations") {
                    setListOpen((value) => !value);
                    return;
                  }
                  setSection("operations");
                  setListOpen(true);
                }}
              >
                <SwitcherGlyph src="/icons/switcher-operations.png?v=2" />
              </button>
            ) : null}
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
          {list ? (
            <div className="mt-1 w-56 border-t border-[var(--border-color)] px-1 py-1">
              <button
                type="button"
                aria-expanded={listOpen}
                onClick={() => setListOpen((value) => !value)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
              >
                <span>{section === "finance" ? "Finance" : "Operations"}</span>
                <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 text-[var(--brand-primary)] transition-transform ${listOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 8 5 5 5-5" />
                </svg>
              </button>
              {listOpen
                ? list.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-2 py-2 text-sm font-semibold hover:bg-[var(--hover-bg)]"
                    >
                      {item.label}
                    </Link>
                  ))
                : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
