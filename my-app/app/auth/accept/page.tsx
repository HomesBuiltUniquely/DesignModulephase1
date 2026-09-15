"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { getApiBase } from "@/app/lib/apiBase";
import { parseHandoffFromLocation, stripHandoffFromUrl } from "../handoff";
import { roleHomePath } from "../roleHome";

export default function AuthAcceptPage() {
  const router = useRouter();
  const { applySession } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function accept() {
      const handoff = parseHandoffFromLocation(window.location);
      stripHandoffFromUrl();
      if (!handoff) {
        router.replace("/login");
        return;
      }
      try {
        const res = await fetch(`${getApiBase()}/api/auth/me`, {
          headers: { Authorization: `Bearer ${handoff.sessionId}` },
        });
        if (!res.ok) {
          if (!cancelled) setError("Session expired. Please log in again.");
          return;
        }
        const text = await res.text();
        let user = handoff.user;
        try {
          if (text) user = JSON.parse(text);
        } catch {
          /* keep handoff user */
        }
        if (cancelled) return;
        applySession(user, handoff.sessionId);
        router.replace(roleHomePath(user.role));
      } catch {
        if (!cancelled) setError("Could not sign you into Design Module.");
      }
    }

    void accept();
    return () => {
      cancelled = true;
    };
  }, [applySession, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-red-700 text-sm">{error}</p>
          <a href="/login" className="text-sm font-medium text-[#32261C] underline">
            Go to Design Module login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-gray-500">Signing you into Design Module…</p>
    </div>
  );
}
