export type DesignFreezeMeetingChecklistSection = {
  title: string;
  requirements: string[];
  note?: string;
};

export const designFreezeMeetingChecklist: DesignFreezeMeetingChecklistSection[] = [
  {
    title: "BEFORE MEETING",
    requirements: [
      "All revisions incorporated",
      "Updated estimate ready",
      "Storage counts revalidated",
      "Structural feasibility checked",
      "Alternate solution ready (if objection comes)"
    ],
    note: "If revisions are not properly done → do not conduct meeting."
  },
  {
    title: "0–10 mins: CONTROL RESET",
    requirements: [
      "Recap first cut decisions",
      "Clearly state: Today we will freeze layout and scope.",
      "Confirm no new areas being added casually"
    ]
  },
  {
    title: "10–50 mins: REVIEW REVISED LAYOUT",
    requirements: [
      "Walk through each room",
      "Confirm storage logic",
      "Confirm circulation space",
      "Lock functional design"
    ],
    note: "Do not allow new major additions here unless cost impact explained."
  },
  {
    title: "50–75 mins: SCOPE LOCK",
    requirements: [
      "Confirm modules included",
      "Confirm accessories included",
      "Confirm exclusions clearly",
      "Mention impact of adding later"
    ],
    note: "This prevents execution arguments."
  },
  {
    title: "75–100 mins: COMMERCIAL ALIGNMENT",
    requirements: [
      "Show updated estimate",
      "Align final project value range",
      "Clarify next milestone (10%)",
      "Explain DQC 1 process"
    ],
    note: "No awkward money discussion — be structured."
  },
  {
    title: "CLOSE MEETING",
    requirements: [
      "Confirm: Layout and scope frozen.",
      "Fix payment timeline",
      "Confirm next stage (DQC 1 submission)"
    ]
  },
  {
    title: "UNIVERSAL RULE FOR ALL MEETINGS",
    requirements: [
      "Fix next date before ending",
      "Send MOM same day",
      "Never leave meeting open-ended"
    ]
  }
];
