/** Post-login landing path for a Design Module role. */
export function roleHomePath(role: string | undefined | null): string {
  if (role === "admin") return "/admin";
  if (role === "territorial_design_manager" || role === "deputy_general_manager") {
    return "/tdm/register";
  }
  if (role === "dqc_manager") return "/dqc-manager/register";
  if (role === "mmt_manager") return "/mmt-manager/register";
  if (role === "finance") return "/finance";
  return "/";
}
