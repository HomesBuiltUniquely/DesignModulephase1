"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("sales_closure_response");
    if (!saved) {
      router.push("/SalesClosure");
      return;
    }
    try {
      setPayload(JSON.parse(saved));
    } catch {
      router.push("/SalesClosure");
    }
  }, [router]);

  if (!payload) return null;

  const message = payload.message ?? (payload.success ? "Sales closure submitted successfully." : "Submission received.");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Sales closure received</h1>
            <p className="text-gray-600 mt-0.5">{message}</p>
          </div>
        </div>
      </div>

      {/* Finance approval notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 mt-0.5">
          <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-800">Pending Finance Approval</p>
          <p className="text-sm text-amber-700 mt-1 leading-relaxed">
            Your payment screenshot has been sent to the Finance team for review.
            Once Finance approves the payment, this lead will automatically appear on the assigned designer&apos;s dashboard.
            If your payment is rejected, you will receive an email notification with instructions to re-submit.
          </p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => router.push("/")}
          className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700"
        >
          Go to Dashboard
        </button>
        <button
          onClick={() => router.push("/SalesClosure")}
          className="px-5 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={() => {
            localStorage.removeItem("sales_closure_response");
            router.push("/SalesClosure");
          }}
          className="px-5 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

