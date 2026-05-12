import { Suspense } from "react";
import SalesClosureForm from "./Components/SalesClosureForm";
import Header from "./Components/Header";

export default function SalesCloser() {
  return (
    <div>
      <Header />
      <Suspense fallback={<div className="min-h-screen bg-purple-50 flex items-center justify-center text-green-950">Loading form…</div>}>
        <SalesClosureForm />
      </Suspense>
    </div>
  );
}
