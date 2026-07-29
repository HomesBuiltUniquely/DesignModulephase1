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
      className={`inline-flex items-center justify-center rounded-lg bg-[#2EE86B] font-bold text-black shadow-sm transition hover:bg-[#24d45d] ${sizeClass} ${className}`}
    >
      Start meeting
    </button>
  );
}
