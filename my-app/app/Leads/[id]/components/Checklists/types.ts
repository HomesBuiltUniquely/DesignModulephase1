export type ChecklistSection = {
  title: string;
  requirements: string[];
  note?: string;
};

export type ChecklistDefinition = {
  title: string;
  sections: ChecklistSection[];
  postUrl: string;
  lastUrl?: string;
  successMessage: string;
  includeSectionNoteInAnswers?: boolean;
  showBreakdownDividerAtIndex?: number;
  breakdownDividerTitle?: string;
};

export type ChecklistKey =
  | "first_cut"
  | "design_freeze"
  | "color_selection"
  | "design_signoff";
