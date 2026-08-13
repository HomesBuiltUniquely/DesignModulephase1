import { Suspense } from "react";
import SalesClosureForm from "./Components/SalesClosureForm";
import Header from "./Components/Header";

export default function SalesCloser() {
  return (
    <div>
      <Header />
      <Suspense fallback={<div className="min-h-screen bg-[#F1F2F6] flex items-center justify-center text-[#32261C]">Loading form…</div>}>
        <SalesClosureForm />
      </Suspense>
    </div>
  );
}
