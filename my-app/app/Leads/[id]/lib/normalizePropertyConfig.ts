export type PropertyConfigKey = "1BHK" | "2BHK" | "3BHK" | "4BHK" | "5BHK";

const CONFIG_ALIASES: Record<string, PropertyConfigKey> = {
  "1BHK": "1BHK",
  "1 BHK": "1BHK",
  "2BHK": "2BHK",
  "2 BHK": "2BHK",
  "3BHK": "3BHK",
  "3 BHK": "3BHK",
  "3 BHk": "3BHK",
  "4BHK": "4BHK",
  "4 BHK": "4BHK",
  "4BHk": "4BHK",
  "4BHK & MORE": "4BHK",
  "4BHK & more": "4BHK",
  "5BHK": "5BHK",
  "5 BHK": "5BHK",
  "5BHK OR VILLA": "5BHK",
  "5BHK OR VILL": "5BHK",
  "VILLA": "5BHK",
  "VILL": "5BHK",
};

/** Normalize lead configuration (e.g. intakeConfiguration / View → CONFIGURATION) to a BHK key. */
export function normalizePropertyConfig(raw: string | null | undefined): PropertyConfigKey {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "2BHK";

  const upper = trimmed.toUpperCase().replace(/\s+/g, " ");
  if (CONFIG_ALIASES[upper]) return CONFIG_ALIASES[upper];

  const compact = upper.replace(/\s+/g, "");
  if (CONFIG_ALIASES[compact]) return CONFIG_ALIASES[compact];

  const bhkMatch = upper.match(/([1-5])\s*BHK/);
  if (bhkMatch) {
    const key = `${bhkMatch[1]}BHK` as PropertyConfigKey;
    if (["1BHK", "2BHK", "3BHK", "4BHK", "5BHK"].includes(key)) return key;
  }

  if (upper.includes("VILLA") || upper.includes("VILL")) return "5BHK";
  if (upper.includes("4")) return "4BHK";

  return "2BHK";
}
