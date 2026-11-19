"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { todayIsoDay } from "@/app/lib/leadMeetingSchedule";

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  /** When true, days before today (Asia/Kolkata) cannot be selected. */
  disablePast?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

function isoFromParts(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function compareIso(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CustomDatePicker({
  value,
  onChange,
  min,
  max,
  disablePast = false,
  disabled = false,
  className = "",
  placeholder = "Select date",
}: CustomDatePickerProps) {
  const effectiveMin = useMemo(() => {
    const today = disablePast ? todayIsoDay() : undefined;
    if (today && min) return compareIso(today, min) >= 0 ? today : min;
    return today ?? min;
  }, [disablePast, min]);
  const effectiveMax = max;

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse value to set initial view month/year
  const initialDate = value ? new Date(`${value}T12:00:00`) : new Date();
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewMonth(d.getMonth());
        setViewYear(d.getFullYear());
      }
    }
  }, [value]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const minViewYear = effectiveMin
    ? Number(effectiveMin.slice(0, 4))
    : null;
  const minViewMonth = effectiveMin
    ? Number(effectiveMin.slice(5, 7)) - 1
    : null;
  const maxViewYear = effectiveMax ? Number(effectiveMax.slice(0, 4)) : null;
  const maxViewMonth = effectiveMax ? Number(effectiveMax.slice(5, 7)) - 1 : null;

  const canGoPrevMonth =
    minViewYear == null ||
    minViewMonth == null ||
    viewYear > minViewYear ||
    (viewYear === minViewYear && viewMonth > minViewMonth);

  const canGoNextMonth =
    maxViewYear == null ||
    maxViewMonth == null ||
    viewYear < maxViewYear ||
    (viewYear === maxViewYear && viewMonth < maxViewMonth);

  const prevMonth = () => {
    if (!canGoPrevMonth) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (!canGoNextMonth) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isDayDisabled = (day: number): boolean => {
    const iso = isoFromParts(viewYear, viewMonth, day);
    if (effectiveMin && compareIso(iso, effectiveMin) < 0) return true;
    if (effectiveMax && compareIso(iso, effectiveMax) > 0) return true;
    return false;
  };

  const handleSelect = (day: number) => {
    if (isDayDisabled(day)) return;
    onChange(isoFromParts(viewYear, viewMonth, day));
    setOpen(false);
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const [y, m, d] = value.split("-").map(Number);
    return y === viewYear && m === viewMonth + 1 && d === day;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };

  // Format display value like "August 4, 2026" or similar
  const displayValue = value
    ? (() => {
        const d = new Date(value);
        if (isNaN(d.getTime())) return value;
        return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
      })()
    : "";

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm font-medium transition-all duration-200 ${
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
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 text-[#32261C]/50"
        >
          <path
            fillRule="evenodd"
            d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 p-3 bg-white border border-[#DDCDC1] rounded-xl shadow-xl animate-fadeInUp min-w-[260px]"
          style={{ transformOrigin: "top" }}
        >
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              disabled={!canGoPrevMonth}
              className={`p-1.5 rounded-md text-[#32261C] transition-colors ${
                canGoPrevMonth ? "hover:bg-[#F1F2F6]" : "opacity-30 cursor-not-allowed"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="text-sm font-bold text-[#32261C]">
              {MONTHS[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={nextMonth}
              disabled={!canGoNextMonth}
              className={`p-1.5 rounded-md text-[#32261C] transition-colors ${
                canGoNextMonth ? "hover:bg-[#F1F2F6]" : "opacity-30 cursor-not-allowed"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-[#32261C]/50 uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const selected = isSelected(day);
              const today = isToday(day);
              const dayDisabled = isDayDisabled(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={dayDisabled}
                  onClick={() => handleSelect(day)}
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold mx-auto transition-all duration-150
                    ${dayDisabled
                      ? "text-gray-300 cursor-not-allowed"
                      : selected 
                      ? "bg-[#EF0101] text-white shadow-md scale-105" 
                      : today
                      ? "bg-[#DDCDC1]/40 text-[#EF0101] hover:bg-[#DDCDC1]"
                      : "text-[#32261C] hover:bg-[#F1F2F6]"
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
