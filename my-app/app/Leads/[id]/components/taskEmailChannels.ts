/**
 * Expected email channel(s) per milestone task (internal team vs external CX vs client).
 * Aligns with the operations sheet: automation / mail UI / WhatsApp columns.
 * Existing HTML mail templates remain in `app/mail-templates/mail-templates/*` — see `mailTemplateRegistry.ts`.
 */
export type EmailChannelKind = "internal" | "external" | "client";

export type TaskEmailChannelInfo = {
  channels: EmailChannelKind[];
  /** Short note for ops (optional). */
  hint?: string;
};

/** Key: `${milestoneIndex}::${trimmedTaskName}` */
const TASK_EMAIL: Record<string, TaskEmailChannelInfo> = {
  // --- D1 SITE MEASUREMENT ---
  "0::Group Description": {
    channels: ["external"],
    hint: "Customer-facing automation after closure / payment",
  },
  "0::Mail loop chain 2 initiate": {
    channels: ["external"],
    hint: "Designer → client mail chain (To: client)",
  },
  "0::D1 for MMT request": {
    channels: ["external"],
    hint: "Visit scheduling / CX-facing comms after slot pick",
  },
  "0::D1 files upload": {
    channels: ["internal"],
    hint: "MMT / site documentation (ops)",
  },

  // --- DQC1 ---
  "1::First cut design + quotation discussion meeting request": {
    channels: ["external"],
    hint: "Calendar invite + customer-facing meeting mail",
  },
  "1::meeting completed": {
    channels: ["external"],
    hint: "MOM / timeline to customer when not fully automated",
  },
  "1::DQC 1 submission - dwg + quotation": {
    channels: ["client", "internal"],
    hint: "Internal DQC review request + customer touchpoints per process",
  },
  "1::DQC 1 approval": {
    channels: ["external"],
    hint: "DQC outcome / next-step mail to customer",
  },

  // --- 10% PAYMENT ---
  "2::10% payment collection": {
    channels: ["internal", "external"],
    hint: "Internal loop + CX payment request",
  },
  "2::10% payment approval": {
    channels: ["external"],
    hint: "Finance receipt / confirmation to customer",
  },

  // --- D2 SITE MASKING ---
  "3::D2 - masking request raise": {
    channels: ["internal", "external"],
    hint: "PM / MMT internal + designer–customer comms",
  },
  "3::D2 - files upload": {
    channels: ["internal"],
    hint: "MMT + PM uploads",
  },

  // --- DQC2 ---
  "4::Material selection meeting + quotation discussion": {
    channels: ["external"],
    hint: "Meeting invite / customer-facing",
  },
  "4::Material selection meeting completed": {
    channels: ["external"],
    hint: "MOM / acknowledgement to customer",
  },
  "4::DQC 2 submission": {
    channels: ["client", "internal"],
    hint: "DQC packet + customer notifications per SOP",
  },
  "4::DQC 2 approval": {
    channels: ["client"],
    hint: "Customer-visible approval / next steps",
  },

  // --- 40% PAYMENT ---
  "5::Design sign off": {
    channels: ["external"],
    hint: "Sign-off meeting request (customer-facing)",
  },
  "5::meeting completed & 40% payment request": {
    channels: ["external"],
    hint: "MOM + 40% payment request to customer",
  },
  "5::40% payment approval": {
    channels: ["external"],
    hint: "Finance confirmation to customer",
  },

  // --- PUSH TO PRODUCTION ---
  "6::Cx approval for production": {
    channels: ["external"],
    hint: "Final approval mail to customer",
  },
  /** Task name in MileStoneArray may include a trailing space */
  "6::POC mail & Timeline submission": {
    channels: ["external"],
    hint: "POC + timeline to customer",
  },
};

export function getTaskEmailChannels(
  milestoneIndex: number,
  taskName: string,
): TaskEmailChannelInfo | null {
  const key = `${milestoneIndex}::${taskName.trim()}`;
  return TASK_EMAIL[key] ?? null;
}
