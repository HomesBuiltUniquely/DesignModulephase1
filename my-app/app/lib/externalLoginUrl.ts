/**
 * Hallway / CRM login page. Designers sign in there and hand off into Design Module.
 * Set NEXT_PUBLIC_EXTERNAL_LOGIN_URL in production to change without code edits.
 */
export const getExternalLoginUrl = (): string =>
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_EXTERNAL_LOGIN_URL?.trim()) ||
  "https://hallway-liart.vercel.app/login";

/** Full-page redirect to the external login (Hallway). */
export function redirectToExternalLogin(): void {
  if (typeof window === "undefined") return;
  window.location.assign(getExternalLoginUrl());
}
