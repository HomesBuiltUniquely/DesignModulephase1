"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getApiBase } from "@/app/lib/apiBase";
import { parseHandoffFromLocation, stripHandoffFromUrl } from "../auth/handoff";
import { roleHomePath } from "../auth/roleHome";
import {
  getLoginPageUrl,
  redirectToLoginPage,
  usesLocalLoginPage,
} from "@/app/lib/externalLoginUrl";
import LocalLoginForm from "./LocalLoginForm";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, applySession } = useAuth();
  const [error, setError] = useState("");
  const [acceptingHandoff, setAcceptingHandoff] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const localLogin = mounted && usesLocalLoginPage();

  useEffect(() => {
    if (loading || user) return;
    if (typeof window === "undefined") return;
    const handoff = parseHandoffFromLocation(window.location);
    if (!handoff) return;

    let cancelled = false;
    setAcceptingHandoff(true);
    stripHandoffFromUrl();

    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/auth/me`, {
          headers: { Authorization: `Bearer ${handoff.sessionId}` },
        });
        if (!res.ok) {
          if (!cancelled) {
            setError("Session expired. Please log in again.");
            setAcceptingHandoff(false);
          }
          return;
        }
        const text = await res.text();
        let nextUser = handoff.user;
        try {
          if (text) nextUser = JSON.parse(text);
        } catch {
          /* keep handoff user */
        }
        if (cancelled) return;
        applySession(nextUser, handoff.sessionId);
        router.replace(roleHomePath(nextUser.role));
      } catch {
        if (!cancelled) {
          setError("Could not sign you into Design Module.");
          setAcceptingHandoff(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, applySession, router]);

  useEffect(() => {
    if (!mounted || loading || user) return;
    if (acceptingHandoff) return;
    if (typeof window === "undefined") return;
    if (parseHandoffFromLocation(window.location)) return;
    if (localLogin) return;
    redirectToLoginPage();
  }, [mounted, loading, user, acceptingHandoff, localLogin]);

  useEffect(() => {
    if (loading || !user) return;
    router.replace(roleHomePath(user.role));
  }, [user, loading, router]);

  if (!mounted || loading || acceptingHandoff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">
          {acceptingHandoff
            ? "Signing you into Design Module…"
            : "Loading…"}
        </p>
      </div>
    );
  }

  if (user) return null;

  if (localLogin) {
    return <LocalLoginForm initialError={error} />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-red-700 text-sm">{error}</p>
          <a
            href={getLoginPageUrl()}
            className="text-sm font-medium text-[#32261C] underline"
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-gray-500">Redirecting to Hallway login…</p>
    </div>
  );
}
