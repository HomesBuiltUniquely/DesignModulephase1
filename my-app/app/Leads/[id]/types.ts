/**
 * Shared types for Lead/Project detail page.
 * Keep all task-popup and DQC-related types here so components stay consistent.
 */

export type QCRemark = {
    id: number;
    priority: 'high' | 'medium' | 'low';
    text: string;
    pinNumber: number;
    xPct: number;
    yPct: number;
    page: number;
    docX?: number;
    docY?: number;
};

export type PopupContext = {
    milestoneIndex: number;
    milestoneName: string;
    taskName: string;
};

export type Dqc1CommentPopupPosition = {
    xPct: number;
    yPct: number;
    page: number;
    docX?: number;
    docY?: number;
};

export type Dqc1Verdict = 'approved' | 'approved_with_changes' | 'rejected';

export type ImageType = {
    id: number;
    img: string;
};

// --- Progress History / View Task Details ---

export type HistoryEventType = 'completed' | 'delayed' | 'note' | 'owner_change' | 'file_upload';

export type HistoryEventUser = {
    name: string;
    avatar?: string;
};

/** Detail payloads for "View Task Details" (steps user took in forms/popups). */
export type D1RequestDetails = {
    kind: 'd1_request';
    date: string;
    time: string;
    assignedExecutive?: string;
};

export type D2MaskingDetails = {
    kind: 'd2_masking';
    date: string;
    time: string;
    maskingExecutive: string;
    assignedExecutive?: string;
};

export type DqcReviewDetails = {
    kind: 'dqc_review';
    verdict: Dqc1Verdict;
    pdfName?: string;
    remarks: Array<{ priority: string; text: string }>;
};

export type MomDetails = {
    kind: 'mom';
    minutes: string;
    referenceFiles: Array<{ name: string; size?: string }>;
};

export type FileUploadDetails = {
    kind: 'file_upload';
    fileName: string;
    size?: string;
    status?: string;
};

export type NoteDetails = {
    kind: 'note';
    noteText: string;
};

export type HistoryEventDetails =
    | D1RequestDetails
    | D2MaskingDetails
    | DqcReviewDetails
    | MomDetails
    | FileUploadDetails
    | NoteDetails;

export type HistoryEvent = {
    id: string;
    type: HistoryEventType;
    taskName?: string;
    milestoneName?: string;
    timestamp: string; // ISO
    description: string;
    user: HistoryEventUser;
    details?: HistoryEventDetails;
};
