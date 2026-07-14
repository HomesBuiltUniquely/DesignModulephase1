export default function Intro() {
  return (
    <main className="w-full bg-[#f7f9fc]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        {/* Left Side - Empty */}
        <div></div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {/* Duration */}
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-gray-400"></div>

            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Duration:
            </span>

            <span className="text-sm font-bold text-gray-900">00:24:18</span>
          </div>

          {/* Previous */}
          <button className="text-sm font-medium text-gray-500 transition hover:text-gray-700">
            Previous
          </button>

          {/* Next Phase */}
          <button className="rounded-md bg-[#2EE86B] px-6 py-2 text-sm font-semibold text-black transition hover:bg-[#24d45d]">
            Next Phase
          </button>

          {/* Close */}
          <button className="text-xl font-light text-gray-500 transition hover:text-gray-800">
            ×
          </button>
        </div>
      </div>
    </main>
  );
}
