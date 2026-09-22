/** Parse Excel duration strings like "12 hrs", "2 Days", "1 Day 12 hrs" into hours. */
export function parseDurationToHours(raw: string): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  let totalHours = 0;
  const dayMatch = text.match(/(\d+(?:\.\d+)?)\s*days?/i);
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*hrs?/i);

  if (dayMatch) totalHours += Number(dayMatch[1]) * 24;
  if (hourMatch) totalHours += Number(hourMatch[1]);

  if (!dayMatch && !hourMatch) {
    const asNumber = Number(text);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
    return null;
  }

  return totalHours > 0 ? totalHours : null;
}

export function formatDurationLabel(hours: number): string {
  if (hours % 24 === 0 && hours >= 24) {
    const days = hours / 24;
    return `${days} ${days === 1 ? "Day" : "Days"}`;
  }
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const rem = hours % 24;
    if (rem === 0) return `${days} ${days === 1 ? "Day" : "Days"}`;
    return `${days} ${days === 1 ? "Day" : "Days"} ${rem} hrs`;
  }
  return `${hours} hrs`;
}
