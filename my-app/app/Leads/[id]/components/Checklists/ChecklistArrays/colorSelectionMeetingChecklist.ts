export type ColorSelectionMeetingChecklistSection = {
  title: string;
  requirements: string[];
  note?: string;
};

export const colorSelectionMeetingChecklist: ColorSelectionMeetingChecklistSection[] = [
  {
    title: "BEFORE MEETING",
    requirements: [
      "Laminate catalog ready",
      "Hardware samples ready",
      "Edge band shades ready",
      "Previous laminate sheet printed"
    ]
  },
  {
    title: "0–10 mins: SET EXPECTATION",
    requirements: [
      "Inform: Today we finalise laminates & hardware.",
      "Mention: Changes after this may affect timeline"
    ]
  },
  {
    title: "10–60 mins: ROOM-WISE SELECTION",
    requirements: [
      "For each room:",
      "Shutter laminate code written",
      "Internal laminate code written",
      "Edge band confirmed",
      "Handle model written",
      "Hinges confirmed",
      "Channels confirmed",
      "Write in front of customer.",
      "No memory-based selection."
    ]
  },
  {
    title: "60–80 mins: CROSS VERIFICATION",
    requirements: [
      "Read out all laminate codes",
      "Confirm no duplication mistakes",
      "Confirm finish types",
      "Mention stock check (if limited shade)"
    ]
  },
  {
    title: "CLOSE MEETING",
    requirements: [
      "Customer signs laminate sheet",
      "Photo taken immediately",
      "Inform next step: DQC 2 submission"
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
