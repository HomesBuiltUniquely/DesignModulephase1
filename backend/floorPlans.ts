/**
 * CRM → Design Module floor-plan payload helpers.
 * Supports multi `floor_plans` from meeting schedule/reschedule, plus legacy single URL.
 * Handles multipart/object-map shapes so a 2nd plan is not dropped.
 */

export type FloorPlanItem = {
  index: number;
  filename: string;
  publicUrl: string;
};

export type NormalizedFloorPlans = {
  /** True when CRM sent `floor_plans` / `floorPlans` (incl. []) or a legacy single URL. */
  provided: boolean;
  /** True when CRM sent an explicit array/list field (not only legacy single URL). */
  fromArray: boolean;
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

function collectFloorPlanSources(
  root: Record<string, unknown>,
): Array<Record<string, unknown> | null | undefined> {
  const connection = asRecord(root.connection);
  const formData = asRecord(root.formData) || asRecord(root.form_data);
  const rawPayload = asRecord(root.rawPayload) || asRecord(root.rawHubPayload);
  const schedule =
    asRecord(root.schedule) ||
    asRecord(root.crmSchedule) ||
    asRecord(root.crm_schedule);
  const meeting = asRecord(root.meeting);
  const discovery = asRecord(root.discovery);
  const files = asRecord(root.files);
  const attachments = asRecord(root.attachments);
  const documents = asRecord(root.documents);
  const rawConnection = rawPayload ? asRecord(rawPayload.connection) : null;
  const rawForm =
    rawPayload
      ? asRecord(rawPayload.formData) || asRecord(rawPayload.form_data)
      : null;
  const rawSchedule = rawPayload
    ? asRecord(rawPayload.schedule) ||
      asRecord(rawPayload.crmSchedule) ||
      asRecord(rawPayload.crm_schedule)
    : null;
  const rawMeeting = rawPayload ? asRecord(rawPayload.meeting) : null;
  const rawFiles = rawPayload ? asRecord(rawPayload.files) : null;
  const connSchedule = connection
    ? asRecord(connection.schedule) || asRecord(connection.crmSchedule)
    : null;

  return [
    root,
    connection,
    formData,
    schedule,
    meeting,
    discovery,
    files,
    attachments,
    documents,
    rawPayload,
    rawConnection,
    rawForm,
    rawSchedule,
    rawMeeting,
    rawFiles,
    connSchedule,
  ];
}

const FLOOR_PLAN_ARRAY_KEYS = [
  "floor_plans",
  "floorPlans",
  "floor_plan_urls",
  "floorPlanUrls",
  "floorPlanFiles",
  "floor_plan_files",
  "floorPlanList",
  "floor_plan_list",
] as const;

const FLOOR_PLAN_LEGACY_KEYS = [
  "floorPlanPublicLink",
  "floorPlanUrl",
  "floor_plan_public_link",
  "floor_plan_url",
  "floorPlanPublicLink2",
  "floorPlanUrl2",
  "floor_plan_public_link_2",
  "floorPlanPublicLink1",
  "floorPlanUrl1",
] as const;

function itemFromUnknown(row: unknown, fallbackIndex: number): FloorPlanItem | null {
  if (typeof row === "string") {
    const publicUrl = row.trim();
    if (!publicUrl) return null;
    if (!/^https?:\/\//i.test(publicUrl) && !publicUrl.includes("/") && !publicUrl.includes(".")) {
      return null;
    }
    return {
      index: fallbackIndex,
      filename: `Floor plan ${fallbackIndex + 1}`,
      publicUrl,
    };
  }
  const rec = asRecord(row);
  if (!rec) return null;
  const publicUrl = trimStr(
    rec.public_url ??
      rec.publicUrl ??
      rec.url ??
      rec.link ??
      rec.href ??
      rec.fileUrl ??
      rec.file_url ??
      rec.s3Url ??
      rec.s3_url ??
      rec.pdfUrl ??
      rec.pdf_url ??
      rec.path ??
      rec.file,
  );
  if (!publicUrl) return null;
  const indexRaw = rec.index ?? rec.Index ?? rec.order ?? rec.seq;
  const index =
    typeof indexRaw === "number" && Number.isFinite(indexRaw)
      ? Math.trunc(indexRaw)
      : Number.isFinite(Number(indexRaw))
        ? Math.trunc(Number(indexRaw))
        : fallbackIndex;
  const filename =
    trimStr(rec.filename ?? rec.fileName ?? rec.name ?? rec.originalName ?? rec.title) ||
    `Floor plan ${index + 1}`;
  return { index, filename, publicUrl };
}

function dedupeFloorPlans(items: FloorPlanItem[]): FloorPlanItem[] {
  const sorted = [...items].sort(
    (a, b) => a.index - b.index || a.filename.localeCompare(b.filename),
  );
  const seen = new Set<string>();
  const unique: FloorPlanItem[] = [];
  for (const item of sorted) {
    const key = item.publicUrl.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique.map((item, i) => ({
    ...item,
    index: i,
    filename: item.filename || `Floor plan ${i + 1}`,
  }));
}

function parseFloorPlanArray(raw: unknown): FloorPlanItem[] | null {
  if (raw == null) return null;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return parseFloorPlanArray(JSON.parse(trimmed));
    } catch {
      // Comma / newline / pipe separated URLs (multipart sometimes flattens this way).
      const parts = trimmed
        .split(/[\n,|;]+/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        const items = parts
          .map((part, i) => itemFromUnknown(part, i))
          .filter((item): item is FloorPlanItem => item != null);
        return items.length ? dedupeFloorPlans(items) : null;
      }
      if (/^https?:\/\//i.test(trimmed)) {
        return [{ index: 0, filename: "Floor plan 1", publicUrl: trimmed }];
      }
      return null;
    }
  }

  if (Array.isArray(raw)) {
    const items: FloorPlanItem[] = [];
    for (let i = 0; i < raw.length; i++) {
      const item = itemFromUnknown(raw[i], i);
      if (item) items.push(item);
    }
    return dedupeFloorPlans(items);
  }

  // Multipart / PHP-style object map: { "0": {...}, "1": {...} } or { file1: url, file2: url }
  const rec = asRecord(raw);
  if (!rec) return null;
  const keys = Object.keys(rec);
  if (keys.length === 0) return [];

  const numericKeys = keys.every((key) => /^\d+$/.test(key));
  const orderedKeys = numericKeys
    ? [...keys].sort((a, b) => Number(a) - Number(b))
    : keys;

  const items: FloorPlanItem[] = [];
  for (let i = 0; i < orderedKeys.length; i++) {
    const item = itemFromUnknown(rec[orderedKeys[i]], i);
    if (item) items.push(item);
  }
  return items.length ? dedupeFloorPlans(items) : null;
}

/**
 * Scan all nests. Prefer the richest non-empty list so an empty/partial nest
 * does not hide a full `floor_plans` array elsewhere in the CRM body.
 */
function findFloorPlansArray(
  sources: Array<Record<string, unknown> | null | undefined>,
  opts?: { preferNonEmpty?: boolean },
): { found: boolean; items: FloorPlanItem[] } {
  let emptyFound = false;
  let best: FloorPlanItem[] | null = null;

  for (const source of sources) {
    if (!source) continue;
    for (const key of FLOOR_PLAN_ARRAY_KEYS) {
      if (!hasOwn(source, key)) continue;
      const parsed = parseFloorPlanArray(source[key]);
      if (parsed == null) continue;
      if (parsed.length === 0) {
        emptyFound = true;
        if (!opts?.preferNonEmpty && best == null) best = [];
        continue;
      }
      if (!best || parsed.length > best.length) best = parsed;
    }
  }

  if (best && best.length > 0) return { found: true, items: best };
  if (emptyFound) return { found: true, items: [] };
  return { found: false, items: [] };
}

function findAllLegacyFloorPlanUrls(
  sources: Array<Record<string, unknown> | null | undefined>,
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (!source) continue;
    for (const key of FLOOR_PLAN_LEGACY_KEYS) {
      const value = trimStr(source[key]);
      if (!value) continue;
      // Support legacy field holding "url1,url2"
      const parts = value.split(/[\n,|;]+/).map((part) => part.trim()).filter(Boolean);
      for (const part of parts.length ? parts : [value]) {
        const keyUrl = part.toLowerCase();
        if (seen.has(keyUrl)) continue;
        seen.add(keyUrl);
        urls.push(part);
      }
    }
  }
  return urls;
}

function findLegacyFloorPlanUrl(
  sources: Array<Record<string, unknown> | null | undefined>,
): string {
  return findAllLegacyFloorPlanUrls(sources)[0] || "";
}

/**
 * Normalize CRM / intake body (and nested connection) into durable floor-plan items.
 * - `floor_plans: []` → provided, empty (clear on reschedule)
 * - missing array + legacy URL(s) → item(s)
 * - missing everything → not provided (leave previous payload alone on merge)
 */
export function normalizeFloorPlansFromCrmBody(
  body: Record<string, unknown> | null | undefined,
): NormalizedFloorPlans {
  const root = body || {};
  const sources = collectFloorPlanSources(root);

  const fromArray = findFloorPlansArray(sources, { preferNonEmpty: true });
  const legacyUrls = findAllLegacyFloorPlanUrls(sources);

  if (fromArray.found && fromArray.items.length > 0) {
    const merged = dedupeFloorPlans([
      ...fromArray.items,
      ...legacyUrls.map((publicUrl, i) => ({
        index: fromArray.items.length + i,
        filename: `Floor plan ${fromArray.items.length + i + 1}`,
        publicUrl,
      })),
    ]);
    return {
      provided: true,
      fromArray: true,
      items: merged,
      primaryUrl: merged[0]?.publicUrl || null,
    };
  }

  if (fromArray.found && fromArray.items.length === 0 && legacyUrls.length === 0) {
    return { provided: true, fromArray: true, items: [], primaryUrl: null };
  }

  if (legacyUrls.length > 0) {
    const items = legacyUrls.map((publicUrl, i) => ({
      index: i,
      filename: legacyUrls.length > 1 ? `Floor plan ${i + 1}` : "Floor plan",
      publicUrl,
    }));
    return {
      provided: true,
      fromArray: false,
      items,
      primaryUrl: items[0]?.publicUrl || null,
    };
  }

  // Explicit empty array with no legacy URLs.
  if (fromArray.found) {
    return { provided: true, fromArray: true, items: [], primaryUrl: null };
  }

  return { provided: false, fromArray: false, items: [], primaryUrl: null };
}

/** Fields to merge into lead payload when CRM provided floor plans (incl. empty). */
export function floorPlanPersistFields(floor: NormalizedFloorPlans): Record<string, unknown> {
  if (!floor.provided) return {};
  return {
    floorPlans: floor.items,
    floor_plans: floor.items,
    floorPlanPublicLink: floor.primaryUrl,
    floorPlanUrl: floor.primaryUrl,
  };
}

/**
 * Upsert merge: never let a legacy single URL wipe a previously stored multi list.
 * Explicit `floor_plans: []` still clears. Explicit richer/same array replaces.
 */
export function mergeFloorPlanPersistFields(
  prevPayload: Record<string, unknown> | null | undefined,
  incoming: NormalizedFloorPlans,
): Record<string, unknown> {
  if (!incoming.provided) return {};

  if (incoming.items.length === 0) {
    return floorPlanPersistFields(incoming);
  }

  const prevItems = extractFloorPlansFromLeadPayload(prevPayload || {});
  if (prevItems.length === 0) {
    return floorPlanPersistFields(incoming);
  }

  // Explicit multi/list from CRM — trust it when it has at least as many as before,
  // otherwise union so a partial reschedule payload cannot drop plan #2.
  if (incoming.fromArray) {
    if (incoming.items.length >= prevItems.length) {
      return floorPlanPersistFields(incoming);
    }
    const union = dedupeFloorPlans([...prevItems, ...incoming.items]);
    return floorPlanPersistFields({
      provided: true,
      fromArray: true,
      items: union,
      primaryUrl: union[0]?.publicUrl || null,
    });
  }

  // Legacy single (or few) URL field(s) only — keep prior multi and add any new URLs.
  const union = dedupeFloorPlans([...prevItems, ...incoming.items]);
  return floorPlanPersistFields({
    provided: true,
    fromArray: false,
    items: union,
    primaryUrl: union[0]?.publicUrl || null,
  });
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

  const sources = collectFloorPlanSources(root);
  const fromArray = findFloorPlansArray(sources, { preferNonEmpty: true });
  if (fromArray.found && fromArray.items.length) return fromArray.items;

  const legacyUrls = findAllLegacyFloorPlanUrls(sources);
  if (legacyUrls.length) {
    return legacyUrls.map((publicUrl, i) => ({
      index: i,
      filename: legacyUrls.length > 1 ? `Floor plan ${i + 1}` : "Floor plan",
      publicUrl,
    }));
  }

  if (fromArray.found) return [];

  return [];
}
