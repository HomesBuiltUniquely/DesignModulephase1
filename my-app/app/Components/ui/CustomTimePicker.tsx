"use client";

import React, { useState, useRef, useEffect } from "react";

interface CustomTimePickerProps {
  value: string; // HH:mm format
  onChange: (time: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")); // 00 to 59
const PERIODS = ["AM", "PM"];

export default function CustomTimePicker({
  value,
  onChange,
  disabled = false,
  className = "",
  placeholder = "Select time",
}: CustomTimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");
  const [period, setPeriod] = useState("AM");

  // Sync internal state with value
  useEffect(() => {
    if (value) {
      const match = value.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2];
        const p = h >= 12 ? "PM" : "AM";
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        setHour(String(h).padStart(2, "0"));
        setMinute(m.padStart(2, "0"));
        setPeriod(p);
      }
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Scroll to selected items when opened
  useEffect(() => {
    if (open && containerRef.current) {
      setTimeout(() => {
        const selectedEls = containerRef.current?.querySelectorAll('[data-selected="true"]');
        selectedEls?.forEach((el) => {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      }, 10);
    }
  }, [open, hour, minute, period]);

  const handleApply = (h: string, m: string, p: string) => {
    let hr24 = parseInt(h, 10);
    if (p === "PM" && hr24 < 12) hr24 += 12;
    if (p === "AM" && hr24 === 12) hr24 = 0;
    onChange(`${String(hr24).padStart(2, "0")}:${m}`);
  };

  const onHourClick = (h: string) => {
    setHour(h);
    handleApply(h, minute, period);
  };

  const onMinuteClick = (m: string) => {
    setMinute(m);
    handleApply(hour, m, period);
  };

  const onPeriodClick = (p: string) => {
    setPeriod(p);
    handleApply(hour, minute, p);
  };

  const displayValue = value
    ? (() => {
        const timeMatch = value.match(/(\d{1,2}):(\d{2})/);
        if (!timeMatch) return value;
        let h = parseInt(timeMatch[1], 10);
        const m = timeMatch[2];
        const p = h >= 12 ? "PM" : "AM";
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${String(h).padStart(2, "0")}:${m} ${p}`;
      })()
    : "";

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Hide scrollbar styling for webkit (clean look) */}
      <style>{`
        .time-picker-scroll::-webkit-scrollbar {
          display: none;
        }
        .time-picker-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* ── Trigger ─────────────────────────────────── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm font-bold transition-all duration-200 ${
          disabled
            ? "bg-[#F1F2F6] border-gray-200 text-gray-400 cursor-not-allowed"
            : open
            ? "bg-white border-[#EF0101] text-[#32261C] shadow-md ring-2 ring-[#EF0101]/10"
            : "bg-white border-[#DDCDC1] text-[#32261C] hover:border-[#EF0101]/60 hover:shadow-sm"
        }`}
      >
        <span className={!value ? "text-gray-400 font-normal" : "text-[#32261C]"}>
          {displayValue || placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-4 h-4 text-[#EF0101]"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </button>

      {/* ── Dropdown Panel ──────────────────────────── */}
      {open && (
        <div
          className="absolute z-50 mt-1 w-[260px] bg-white border border-[#DDCDC1] rounded-xl shadow-xl animate-fadeInUp overflow-hidden"
          style={{ transformOrigin: "top" }}
        >
          <div className="flex h-[240px]">
            
            {/* Hours Column */}
            <div className="flex-1 border-r border-gray-200 overflow-y-auto time-picker-scroll scroll-smooth flex flex-col items-center">
              {HOURS.map((h) => (
                <button
                  key={`h-${h}`}
                  type="button"
                  data-selected={hour === h}
                  onClick={() => onHourClick(h)}
                  className={`w-full py-3 text-sm transition-colors ${
                    hour === h 
                      ? "bg-[#EF0101] text-white font-bold" 
                      : "text-[#32261C] hover:bg-gray-100"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>

            {/* Minutes Column */}
            <div className="flex-1 border-r border-gray-200 overflow-y-auto time-picker-scroll scroll-smooth flex flex-col items-center">
              {MINUTES.map((m) => (
                <button
                  key={`m-${m}`}
                  type="button"
                  data-selected={minute === m}
                  onClick={() => onMinuteClick(m)}
                  className={`w-full py-3 text-sm transition-colors ${
                    minute === m 
                      ? "bg-[#EF0101] text-white font-bold" 
                      : "text-[#32261C] hover:bg-gray-100"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* AM/PM Column */}
            <div className="flex-1 overflow-y-auto time-picker-scroll flex flex-col justify-center items-center h-full">
              {PERIODS.map((p) => (
                <button
                  key={`p-${p}`}
                  type="button"
                  data-selected={period === p}
                  onClick={() => onPeriodClick(p)}
                  className={`w-full py-4 text-sm transition-colors ${
                    period === p 
                      ? "bg-[#EF0101] text-white font-bold" 
                      : "text-[#32261C] hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
