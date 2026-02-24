"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewPage() {
  const router = useRouter();
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("sales_closure_response");
    if (!saved) {
      router.push("/SalesClosure");
      return;
    }
    setPayload(JSON.parse(saved));
  }, [router]);

  if (!payload) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-gray-800">Submitted JSON</h1>

      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto text-sm">
        {JSON.stringify(payload, null, 2)}
      </pre>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => router.push("/")}
          className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium"
        >
          View in Queue
        </button>
        <button
          onClick={() => router.push("/SalesClosure")}
          className="px-5 py-2 rounded-lg border border-gray-300"
        >
          Back
        </button>
        <button
          onClick={() => {
            localStorage.removeItem("sales_closure_response");
            router.push("/SalesClosure");
          }}
          className="px-5 py-2 rounded-lg bg-red-600 text-white"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
