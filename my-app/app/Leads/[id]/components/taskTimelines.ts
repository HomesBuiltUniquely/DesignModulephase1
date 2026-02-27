// Simple timeline mapping for 1BHK configuration.
// Key format: `${milestoneName}::${taskName}`

export const TIMELINE_1BHK: Record<string, string> = {
  // Milestone 1: D1 SITE MEASUREMENT
  "D1 SITE MEASUREMENT::Group Description": "24 hrs from payment",
  "D1 SITE MEASUREMENT::Mail loop chain 2 initiate": "Same day of GD change",
  "D1 SITE MEASUREMENT::D1 for MMT request": "48 hrs from payment",
  "D1 SITE MEASUREMENT::D1 files upload": "24 hrs from D1",

  // Milestone 2: DQC1 (examples – can be refined with more rows from sheet)
  "DQC1::First cut design + quotation discussion meeting request":
    "24 hrs from D1 file received",
  "DQC1::meeting completed": "As per meeting date (MOM submission)",
  "DQC1::Design finalisation meeting request":
    "2–3 days from last meeting (design freeze)",
  "DQC1::DQC 1 submission - dwg + quotation": "2 days from last meeting",
  "DQC1::DQC 1 approval": "After DQC review",

  // Milestone 3: 10% PAYMENT
  "10% PAYMENT::10% payment collection": "48 hrs from last meeting",
  "10% PAYMENT::10% payment approval": "24 hrs of DQC1 file sent",
};

export function getTaskTimeline(
  milestoneName: string,
  taskName: string,
  propertyConfig: string | undefined,
): string | undefined {
  // For now we only have explicit mapping for 1BHK; others can be added later.
  const key = `${milestoneName}::${taskName}`;
  return TIMELINE_1BHK[key];
}

