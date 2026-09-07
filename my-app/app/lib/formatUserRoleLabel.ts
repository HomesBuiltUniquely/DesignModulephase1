/** Display labels for user roles. Role slugs in the DB stay unchanged. */
export function formatUserRoleLabel(role: string | null | undefined): string {
  const r = (role || "").trim().toLowerCase();
  if (!r) return "";
  if (r === "territorial_design_manager") return "Territory Design Manager";
  if (r === "senior_project_manager") return "Senior Project Manager";
  if (r === "project_manager") return "Project Manager";
  if (r === "deputy_general_manager") return "Deputy General Manager";
  if (r === "design_manager") return "Design Manager";
  if (r === "dqc_manager") return "DQC Manager";
  if (r === "mmt_manager") return "MMT Manager";
  if (r === "mmt_executive") return "MMT Executive";
  if (r === "escalation_manager") return "Escalation Manager";
  return r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
