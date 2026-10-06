/**
 * Login routing: local Design Module form on dev hosts, Hallway on production.
 *
 * - auto (default): local form on localhost / private LAN IPs; Hallway elsewhere
 * - local | external: force mode (NEXT_PUBLIC_LOGIN_MODE)
 * - NEXT_PUBLIC_EXTERNAL_LOGIN_URL: Hallway URL when using external login
 */

export const LOCAL_LOGIN_PATH = "/login";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type LoginMode = "auto" | "local" | "external";

function getConfiguredLoginMode(): LoginMode {
  const raw = process.env.NEXT_PUBLIC_LOGIN_MODE?.trim().toLowerCase();
  if (raw === "local" || raw === "external") return raw;
  return "auto";
}

/** Private/LAN hosts used for local Design Module testing. */
export function isLocalDevHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  if (LOCAL_HOSTNAMES.has(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
}

/** True when the in-app Design Module login page should be shown. */
export function usesLocalLoginPage(): boolean {
  const mode = getConfiguredLoginMode();
  if (mode === "local") return true;
  if (mode === "external") return false;
  if (typeof window === "undefined") return false;
  return isLocalDevHost(window.location.hostname);
}

export const getExternalLoginUrl = (): string =>
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_EXTERNAL_LOGIN_URL?.trim()) ||
  "https://hallway-liart.vercel.app/login";

/** URL for “go to login” links (local /login vs Hallway). */
export function getLoginPageUrl(): string {
  if (typeof window !== "undefined" && usesLocalLoginPage()) {
    return `${window.location.origin}${LOCAL_LOGIN_PATH}`;
  }
  return getExternalLoginUrl();
}

/** Send user to login — local form or Hallway depending on environment. */
export function redirectToLoginPage(): void {
  if (typeof window === "undefined") return;
  if (usesLocalLoginPage()) {
    window.location.assign(LOCAL_LOGIN_PATH);
    return;
  }
  window.location.assign(getExternalLoginUrl());
}

/** @deprecated Prefer redirectToLoginPage */
export function redirectToExternalLogin(): void {
  redirectToLoginPage();
}
