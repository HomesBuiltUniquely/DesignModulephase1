/**
 * Backend API base URL. Set NEXT_PUBLIC_API_URL in production (e.g. in AWS).
 * Defaults to local backend for development.
 */
export const getApiBase = (): string =>
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) ||
  "http://localhost:3001";
