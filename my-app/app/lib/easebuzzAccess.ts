/** Easebuzz online links are super-admin only. Other roles keep offline proof upload. */
export function canUseEasebuzzOnline(role: string | null | undefined): boolean {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin" || r === "super_admin" || r === "superadmin";
}
