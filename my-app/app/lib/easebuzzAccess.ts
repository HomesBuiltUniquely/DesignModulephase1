/**
 * Easebuzz online payment links — available to admin + design team.
 * Other roles (e.g. finance) keep offline proof upload only.
 */
export function canUseEasebuzzOnline(role: string | null | undefined): boolean {
  const r = String(role || "").trim().toLowerCase();
  return (
    r === "admin" ||
    r === "super_admin" ||
    r === "superadmin" ||
    r === "designer" ||
    r === "design_manager" ||
    r === "territorial_design_manager" ||
    r === "deputy_general_manager"
  );
}
