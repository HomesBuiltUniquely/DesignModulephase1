/**
 * UI / Prolance display PID: always `HUB-{designLeadId}` (e.g. HUB-1970).
 * Never use CRM external refs like HUB-AL-88DSPV1FMV, and never emit HUB-HUB-*.
 * CRM ids stay on `lead.pid` via {@link formatCrmExternalRef}.
 */
export function formatHubPid(pid?: string | number | null, leadId?: number | null): string {
  if (leadId != null && Number.isFinite(Number(leadId)) && Number(leadId) > 0) {
    return `HUB-${Number(leadId)}`;
  }

  const raw = pid != null ? String(pid).trim() : "";
  if (!raw) return "";

  // Strip repeated HUB- / "HUB " prefixes (fixes HUB-HUB 1970)
  let clean = raw;
  while (/^HUB[\s-]*/i.test(clean)) {
    clean = clean.replace(/^HUB[\s-]*/i, "").trim();
  }

  // Only accept a bare numeric design id as fallback — never AL-/GL- CRM refs
  if (/^\d+$/.test(clean)) {
    return `HUB-${clean}`;
  }

  return "";
}

/**
 * CRM external reference without a leading HUB- prefix.
 * e.g. HUB-AL-88DSPV1FMV → AL-88DSPV1FMV
 */
export function formatCrmExternalRef(pid?: string | number | null): string {
  const raw = pid != null ? String(pid).trim() : "";
  if (!raw) return "";
  let clean = raw;
  while (/^HUB[\s-]*/i.test(clean)) {
    clean = clean.replace(/^HUB[\s-]*/i, "").trim();
  }
  return clean;
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
