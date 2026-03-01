// app/Components/Types/Types.tsx
export type LeadshipTypes = {
    id: number;
    pid: string;
    projectName: string;
    projectStage: string;
    createAt: string;
    updateAt: string;
    contactNo?: string; // client contact from sales closure (for WhatsApp group)
    clientEmail?: string; // client email from sales closure (for mail chain)
    isOnHold?: boolean;
    resumeAt?: string | null;
    designerName?: string | null; // from sales closure payload (for DQC review panel)
    revision?: string | null; // for DQC review panel
};