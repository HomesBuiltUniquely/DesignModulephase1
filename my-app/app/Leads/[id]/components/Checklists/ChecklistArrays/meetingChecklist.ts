export type MeetingChecklistSection = {
  title: string;
  requirements: string[];
  note?: string;
};

export const meetingChecklist: MeetingChecklistSection[] = [
  {
    title: "BEFORE THE MEETING (15 mins prep)",
    requirements: [
      "3D views ready (no raw renders)",
      "Zoning logic clearly defined",
      "Storage count calculated",
      "Budget range aligned",
      "Alternate option ready (if customer rejects primary idea)",
      "Timeline rough plan prepared"
    ],
    note: "If these aren’t ready → meeting should not happen."
  },
  {

    title: "0–10 mins: SET CONTROL",
    requirements: [
      "Reconfirm scope",
      "Reconfirm budget range",
      "Set agenda: Today we will finalise layout direction.",
      "Inform duration clearly"
    ],
    note: "If you don’t set agenda, customer takes over."
  },
  {
    title: "10–50 mins: PRESENT LAYOUT LOGIC (NOT COLORS)",
    requirements: [
      "Explain space planning logic",
      "Explain storage functionality",
      "Explain movement flow",
      "Clarify pros & constraints"
    ],
    note: "Don’t jump into laminate talk yet. First cut = layout acceptance."
  },
  {
    title: "50–80 mins: FEEDBACK EXTRACTION",
    requirements: [
      "What works for you here?",
      "What feels uncomfortable?",
      "Any must-have change?"
    ],
    note: "Document clearly. Do NOT redesign live."
  },
  {
    title: "80–100 mins: BUDGET ALIGNMENT",
    requirements: [
      "Show estimate summary",
      "Align on project value range",
      "Clarify additions = cost impact",
      "Remove unrealistic expectations gently"
    ],
    note: "This prevents shock later."
  },
  {
    title: "100–115 mins: CLOSE DECISIONS",
    requirements: [
      "Confirm layout direction",
      "Confirm zones frozen",
      "Identify exact revisions",
      "Fix next meeting date (Design Freeze)"
    ],
    note: "Never end meeting without next date fixed."
  },
  {
    title: "115–120 mins: CONFIDENCE CLOSE",
    requirements: [
      "Recap decisions",
      "Mention next timeline",
      "Thank them confidently"
    ],
    note: "Meeting should end feeling directional, not open-ended."
  },
  {
    title: "POST MEETING CHECK",
    requirements: [
      "MOM sent same day",
      "Next meeting scheduled",
      "Revisions documented",
      "No ambiguous decisions"
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

