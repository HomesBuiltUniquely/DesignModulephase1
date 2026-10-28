/**
 * CRM → Design Module floor-plan payload helpers.
 * Supports multi `floor_plans` from meeting schedule/reschedule, plus legacy single URL.
 */

export type FloorPlanItem = {
  index: number;
  filename: string;
  publicUrl: string;
};

export type NormalizedFloorPlans = {
  /** True when CRM sent `floor_plans` / `floorPlans` (incl. []) or a legacy single URL. */
  provided: boolean;
  items: FloorPlanItem[];
  primaryUrl: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function trimStr(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function parseFloorPlanArray(raw: unknown): FloorPlanItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: FloorPlanItem[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (typeof row === "string") {
      const publicUrl = row.trim();
      if (!publicUrl) continue;
      items.push({
        index: i,
        filename: `Floor plan ${i + 1}`,
        publicUrl,
      });
      continue;
    }
    const rec = asRecord(row);
    if (!rec) continue;
    const publicUrl = trimStr(
      rec.public_url ?? rec.publicUrl ?? rec.url ?? rec.link ?? rec.href,
    );
    if (!publicUrl) continue;
    const indexRaw = rec.index ?? rec.Index;
    const index =
      typeof indexRaw === "number" && Number.isFinite(indexRaw)
        ? Math.trunc(indexRaw)
        : Number.isFinite(Number(indexRaw))
          ? Math.trunc(Number(indexRaw))
          : i;
    const filename =
      trimStr(rec.filename ?? rec.fileName ?? rec.name ?? rec.originalName) ||
      `Floor plan ${index + 1}`;
    items.push({ index, filename, publicUrl });
  }
  items.sort((a, b) => a.index - b.index || a.filename.localeCompare(b.filename));
  // Dedupe by publicUrl, keep first (lowest index).
  const seen = new Set<string>();
  const unique: FloorPlanItem[] = [];
  for (const item of items) {
    if (seen.has(item.publicUrl)) continue;
    seen.add(item.publicUrl);
    unique.push(item);
  }
  return unique;
}

function findFloorPlansArray(
  sources: Array<Record<string, unknown> | null | undefined>,
): { found: boolean; items: FloorPlanItem[] } {
  for (const source of sources) {
    if (!source) continue;
    for (const key of ["floor_plans", "floorPlans"] as const) {
      if (!hasOwn(source, key)) continue;
      const parsed = parseFloorPlanArray(source[key]);
      return { found: true, items: parsed || [] };
    }
  }
  return { found: false, items: [] };
}

function findLegacyFloorPlanUrl(
  sources: Array<Record<string, unknown> | null | undefined>,
): string {
  for (const source of sources) {
    if (!source) continue;
    for (const key of [
      "floorPlanPublicLink",
      "floorPlanUrl",
      "floor_plan_public_link",
      "floor_plan_url",
    ] as const) {
      const value = trimStr(source[key]);
      if (value) return value;
    }
  }
  return "";
}

/**
 * Normalize CRM / intake body (and nested connection) into durable floor-plan items.
 * - `floor_plans: []` → provided, empty (clear on reschedule)
 * - missing array + legacy URL → one item
 * - missing everything → not provided (leave previous payload alone on merge)
 */
export function normalizeFloorPlansFromCrmBody(
  body: Record<string, unknown> | null | undefined,
): NormalizedFloorPlans {
  const root = body || {};
  const connection = asRecord(root.connection);
  const formData = asRecord(root.formData) || asRecord(root.form_data);
  const rawPayload = asRecord(root.rawPayload) || asRecord(root.rawHubPayload);
  const sources = [root, connection, formData, rawPayload];

  const fromArray = findFloorPlansArray(sources);
  if (fromArray.found) {
    return {
      provided: true,
      items: fromArray.items,
      primaryUrl: fromArray.items[0]?.publicUrl || null,
    };
  }

  const legacyUrl = findLegacyFloorPlanUrl(sources);
  if (legacyUrl) {
    return {
      provided: true,
      items: [{ index: 0, filename: "Floor plan", publicUrl: legacyUrl }],
      primaryUrl: legacyUrl,
    };
  }

  return { provided: false, items: [], primaryUrl: null };
}

/** Fields to merge into lead payload when CRM provided floor plans (incl. empty). */
export function floorPlanPersistFields(floor: NormalizedFloorPlans): Record<string, unknown> {
  if (!floor.provided) return {};
  return {
    floorPlans: floor.items,
    floorPlanPublicLink: floor.primaryUrl,
    floorPlanUrl: floor.primaryUrl,
  };
}

/** Read floor plans already stored on a Design lead payload. */
export function extractFloorPlansFromLeadPayload(
  payloadInput: unknown,
): FloorPlanItem[] {
  let root: Record<string, unknown> = {};
  if (typeof payloadInput === "string") {
    try {
      root = JSON.parse(payloadInput) as Record<string, unknown>;
    } catch {
      return [];
    }
  } else if (payloadInput && typeof payloadInput === "object") {
    root = payloadInput as Record<string, unknown>;
  } else {
    return [];
  }

  const connection = asRecord(root.connection);
  const formData = asRecord(root.formData) || asRecord(root.form_data);
  const rawPayload = asRecord(root.rawPayload) || asRecord(root.rawHubPayload);
  const normalized = normalizeFloorPlansFromCrmBody({
    ...root,
    ...(connection ? { connection } : {}),
    ...(formData ? { formData } : {}),
    ...(rawPayload ? { rawPayload } : {}),
  });

  if (normalized.items.length) return normalized.items;

  // Fallback: stored array only (no legacy) already handled by normalize.
  const fromStored =
    parseFloorPlanArray(root.floorPlans) ||
    parseFloorPlanArray(connection?.floorPlans) ||
    parseFloorPlanArray(formData?.floorPlans);
  return fromStored || [];
}
