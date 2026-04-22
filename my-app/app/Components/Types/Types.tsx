// app/Components/Types/Types.tsx
export type LeadshipTypes = {
    id: number;
    pid: string;
    projectName: string;
    projectStage: string;
    createAt: string;
    updateAt: string;
    contactNo?: string; // client contact from sales closure (for WhatsApp group)
    clientEmail?: string | null; // client email from sales closure (for mail chain)
    /** Secondary client email when primary is missing or for CC / backup */
    alternateClientEmail?: string | null;
    isOnHold?: boolean;
    resumeAt?: string | null;
    designerName?: string | null; // from sales closure payload (for DQC review panel)
    revision?: string | null; // for DQC review panel
    /** Current milestone name from task completions (e.g. "D1 SITE MEASUREMENT", "10% PAYMENT") */
    currentMilestoneName?: string | null;
    currentMilestoneIndex?: number;
    /** Progress within current milestone 0–100 (tasks completed in that milestone) */
    currentMilestoneProgress?: number | null;
    assigned_designer_id?: number | null;
    assigned_project_manager_id?: number | null;
    projectManagerName?: string | null;
    /** Sales closure experience center / branch (from lead payload) */
    experienceCenter?: string | null;
};