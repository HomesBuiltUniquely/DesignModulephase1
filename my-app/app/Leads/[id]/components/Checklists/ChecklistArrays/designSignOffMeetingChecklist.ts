export type DesignSignOffMeetingChecklistSection = {
  title: string;
  requirements: string[];
  note?: string;
};

export const designSignOffMeetingChecklist: DesignSignOffMeetingChecklistSection[] = [
  {
    title: "BEFORE MEETING",
    requirements: [
      "Final drawings aligned",
      "Laminate sheet attached",
      "Final estimate matches drawings",
      "Hardware incorporated",
      "No pending revisions"
    ],
    note: "If anything pending → do NOT conduct sign-off."
  },
  {
    title: "0–15 mins: RESET CONTROL",
    requirements: [
      "Inform clearly: 'This is final design sign-off.'",
      "Mention: Post sign-off, scope changes require change order."
    ],
    note: "Set seriousness early."
  },
  {
    title: "15–60 mins: FINAL WALKTHROUGH",
    requirements: [
      "Room-wise Layout confirmation",
      "Laminate confirmation",
      "Hardware confirmation",
      "Special features confirmation"
    ],
    note: "No casual redesign here."
  },
  {
    title: "60–75 mins: COMMERCIAL CONFIRMATION",
    requirements: [
      "Final project value confirmed",
      "Confirm 40% payable",
      "Mention production activation"
    ],
    note: "No hesitation here."
  },
  {
    title: "CLOSE",
    requirements: [
      "Confirm: 'Design formally frozen.'",
      "Mention next step: 40% + Production",
      "Thank confidently"
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