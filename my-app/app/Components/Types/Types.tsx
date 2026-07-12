// app/Components/Types/Types.tsx
export type ConfigScopeRoomUnit = {
    label?: string;
    selected?: boolean;
};

export type ConfigScopeRoom = {
    roomName?: string;
    units?: ConfigScopeRoomUnit[];
    unitsRequired?: string[];
    falseCeilingRequired?: boolean;
    notes?: string | null;
};

export type ConfigScopeReferenceFile = {
    id?: string;
    fileName?: string;
    mimeType?: string | null;
    viewUrl?: string | null;
};

export type ConfigScopeSummary = {
    propertyName?: string | null;
    bookingType?: string | null;
    designStylePreference?: string | null;
    expectedTimeline?: string | null;
    projectUnderstanding?: string | null;
    /** CRM: Family Size & Details */
    familySizeDetails?: string | null;
    kitchenLayout?: string | null;
    materialFinish?: string | null;
    selectedRoomNames?: string[];
    selectedRooms?: ConfigScopeRoom[];
    familyContactName?: string | null;
    familyContactRelationship?: string | null;
    familyContactPhone?: string | null;
    designHandoffNotes?: string | null;
    salesRiskNotes?: string | null;
    miscAddOns?: string[];
    wfhSetup?: boolean;
    petFriendly?: boolean;
    referenceInspiration?: {
        aestheticNotes?: string | null;
        references?: ConfigScopeReferenceFile[];
    } | null;
    financialGuardrails?: {
        investmentRange?: string | null;
        sensitivity?: string | null;
        financing?: string | null;
    } | null;
    internalExecutiveNotes?: {
        personalityType?: string | null;
        competition?: string | null;
        executiveSummary?: string | null;
        internalNotes?: string | null;
        closureProbability?: string | null;
    } | null;
};

export type PhaseSummaryBag = Record<string, unknown>;

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
    /** Prolance Origin project ID after designer creates project from this lead */
    prolanceProjectId?: number | null;
    /** Last Prolance quotation ID from Get Quote (optional, for reference) */
    prolanceQuoteId?: number | null;
    projectManagerName?: string | null;
    /** Sales closure experience center / branch (from lead payload) */
    experienceCenter?: string | null;
    experience_center?: string | null;
    sales_closure_ec?: string | null;
    branch?: string | null;
    /** CRM / intake appointment date (from payload) */
    appointmentDate?: string | null;
    /** CRM / intake appointment slot (from payload) */
    appointmentSlot?: string | null;
    /** External intake customer name (formData.customer_name) */
    intakeCustomerName?: string | null;
    /** External intake configuration (e.g. rawPayload.configuration) */
    intakeConfiguration?: string | null;
    /** External intake notes (e.g. rawPayload.propertyNotes) */
    intakeNotes?: string | null;
    intakeBudget?: string | null;
    intakeLanguage?: string | null;
    intakeBookingType?: string | null;
    intakePropertyLocation?: string | null;
    intakeMeetingType?: string | null;
    floorPlanPublicLink?: string | null;
    salesExecutive?: string | null;
    intakePincode?: string | null;
    intakeLeadSource?: string | null;
    intakePossessionDate?: string | null;
    intakeAltPhone?: string | null;
    configScopeSummary?: ConfigScopeSummary | null;
    experienceSummary?: PhaseSummaryBag | null;
    decisionSummary?: PhaseSummaryBag | null;
    financeApprovedRaw?: string;
};
