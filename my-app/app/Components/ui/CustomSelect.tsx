"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "xs" | "sm" | "md";
  minWidth?: string;
  /** Optional label for the group header shown inside dropdown */
  groupLabel?: string;
  id?: string;
}

const sizeClasses = {
  xs: "px-2.5 py-1.5 text-xs",
  sm: "px-3 py-2 text-sm",
  md: "px-3.5 py-2.5 text-sm",
};

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className = "",
  size = "sm",
  minWidth,
  groupLabel,
  id,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({
    position: "absolute",
    opacity: 0,
    pointerEvents: "none",
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        (!listRef.current || !listRef.current.contains(e.target as Node))
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Compute and update dropdown position
  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownStyle({
          position: "absolute",
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
          minWidth: 160,
          opacity: 1,
          pointerEvents: "auto",
        });
      }
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  // Scroll highlighted item into view locally without causing window scroll
  useEffect(() => {
    if (open && highlightedIndex >= 0 && listRef.current) {
      const listEl = listRef.current;
      const items = listEl.querySelectorAll("[data-option]");
      const itemEl = items[highlightedIndex] as HTMLElement;
      if (itemEl) {
        const containerTop = listEl.scrollTop;
        const containerBottom = containerTop + listEl.clientHeight;
        const elemTop = itemEl.offsetTop;
        const elemBottom = elemTop + itemEl.offsetHeight;

        if (elemTop < containerTop) {
          listEl.scrollTop = elemTop;
        } else if (elemBottom > containerBottom) {
          listEl.scrollTop = elemBottom - listEl.clientHeight;
        }
      }
    }
  }, [highlightedIndex, open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      const enabledOptions = options.filter((o) => !o.disabled);
      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          if (!open) {
            setOpen(true);
            setHighlightedIndex(0);
          } else if (highlightedIndex >= 0) {
            const opt = enabledOptions[highlightedIndex];
            if (opt) { onChange(opt.value); setOpen(false); }
          }
          break;
        case "Escape":
          setOpen(false);
          break;
        case "ArrowDown":
          e.preventDefault();
          if (!open) { setOpen(true); setHighlightedIndex(0); }
          else setHighlightedIndex((i) => Math.min(i + 1, enabledOptions.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Tab":
          setOpen(false);
          break;
      }
    },
    [disabled, open, highlightedIndex, options, onChange],
  );

  const toggle = () => {
    if (disabled) return;
    setOpen((o) => {
      if (!o) setHighlightedIndex(options.findIndex((opt) => opt.value === value));
      return !o;
    });
  };

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className}`}
      style={minWidth ? { minWidth } : undefined}
    >
      {/* ── Trigger ─────────────────────────────────── */}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={`
          w-full flex items-center justify-between gap-2 font-medium rounded-lg border
          transition-all duration-200 cursor-pointer
          ${sizeClasses[size]}
          ${disabled
            ? "bg-[#F1F2F6] border-gray-200 text-gray-400 cursor-not-allowed"
            : open
              ? "bg-white border-[#EF0101] text-[#32261C] shadow-md ring-2 ring-[#EF0101]/10"
              : "bg-white border-[#DDCDC1] text-[#32261C] hover:border-[#EF0101]/60 hover:shadow-sm"
          }
        `}
      >
        <span className={`truncate ${!selected ? "text-gray-400 font-normal" : ""}`}>
          {selected ? selected.label : placeholder}
        </span>
        {/* Chevron — rotates when open */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 flex-shrink-0 text-[#32261C]/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* ── Dropdown Panel ──────────────────────────── */}
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={listRef}
          role="listbox"
          className="
            z-[99999]
            bg-white border border-[#DDCDC1] rounded-xl shadow-xl overflow-hidden
            max-h-60 overflow-y-auto
            custom-select-dropdown
          "
          style={{
            ...dropdownStyle,
            animation: "customSelectSlideDown 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            transformOrigin: "top",
          }}
        >
          {groupLabel && (
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#32261C]/40 border-b border-[#DDCDC1]/60">
              {groupLabel}
            </p>
          )}
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = highlightedIndex === idx;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                data-option
                aria-selected={isSelected}
                disabled={opt.disabled}
                onClick={() => { if (!opt.disabled) { onChange(opt.value); setOpen(false); } }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`
                  w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2
                  transition-colors duration-100
                  ${opt.disabled ? "text-gray-300 cursor-not-allowed" : "cursor-pointer"}
                  ${isSelected
                    ? "bg-[#EF0101] text-white font-semibold"
                    : isHighlighted
                      ? "bg-[#F1F2F6] text-[#32261C]"
                      : "text-[#32261C] hover:bg-[#F1F2F6]"
                  }
                `}
              >
                {/* Tick for selected */}
                <span className={`w-4 h-4 flex-shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`}>
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
