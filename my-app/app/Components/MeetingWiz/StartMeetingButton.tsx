"use client";

type Props = {
  onClick: () => void;
  className?: string;
  size?: "sm" | "md";
};

export function StartMeetingButton({ onClick, className = "", size = "sm" }: Props) {
  const sizeClass =
    size === "md"
      ? "px-4 py-2.5 text-sm"
      : "px-3 py-1.5 text-xs";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg bg-[var(--brand-primary)] font-bold text-white shadow-sm transition hover:opacity-90 ${sizeClass} ${className}`}
    >
      Start meeting
    </button>
  );
}
