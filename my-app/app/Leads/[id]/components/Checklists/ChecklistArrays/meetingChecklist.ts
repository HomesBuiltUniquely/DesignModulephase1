export type MeetingChecklistSection = {
  title: string;
  requirements: string[];
  note?: string;
};

export const meetingChecklist: MeetingChecklistSection[] = [
  {
    title: "Before First Meeting Checklist",
    requirements: [
      "3D views must be ready.",
      "Alternate options should be prepared in case the customer asks.",
      "A rough design timeline plan must be prepared.",
      "Scope of work must be reconfirmed.",
      "Space planning must be completed before the meeting.",
    ],
  },
];
