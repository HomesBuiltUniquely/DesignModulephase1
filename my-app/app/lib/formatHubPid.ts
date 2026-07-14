/** Normalize lead PID to `HUB-2354` (never `HUB-HUB-2354`). */
export function formatHubPid(pid?: string | number | null, leadId?: number | null): string {
  const fromPid = pid != null && String(pid).trim() !== "" ? String(pid).trim() : "";
  const fromLead = leadId != null && Number(leadId) > 0 ? String(leadId) : "";
  const raw = fromPid || fromLead;
  if (!raw) return "";
  const clean = raw.replace(/^HUB-/i, "");
  return clean ? `HUB-${clean}` : "";
}

/** Prolance project title: `HUB-2354 - Project Name`. */
export function formatProlanceProjectName(
  projectName: string,
  pid?: string | number | null,
  leadId?: number | null,
): string {
  const name = projectName.trim() || "Untitled Project";
  const hubRef = formatHubPid(pid, leadId);
  if (!hubRef) return name;
  if (name.toUpperCase().includes(hubRef.toUpperCase())) return name;
  return `${hubRef} - ${name}`;
}
