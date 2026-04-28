'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { LeadshipTypes } from '../../Components/Types/Types';
import MileStonesArray from '@/app/Components/Types/MileStoneArray';
import type { ImageType, QCRemark, HistoryEvent } from './types';
import {
    LeadDetailHeader,
    ClientEmailsSection,
    MilestonesCard,
    HistoryCard,
    FilesCard,
    ChatCard,
    TaskModal,
    ViewTaskDetailsModal,
    PopupD1Measurement,
    PopupFirstCutDesign,
    PopupMeetingCompleted,
    PopupDqc1Approval,
    PopupDqcDesignerView,
    PopupD2MaskingRequest,
    PopupDqcSubmission,
    PopupPlaceholder,
    Popup10pPaymentCollection,
    PopupGroupDescription,
    PopupMailLoopChain,
    GenericMeetingChecklistPopup,
    PopupAssignProjectManager,
    PopupProjectManagerApproval,
    Popup40pCollection,
} from './components';
import { checklistDefinitions, getChecklistKeyForTask } from './components/Checklists/checklistRegistry';
import { buildAuthHeaders, getApiBase } from '@/app/lib/apiBase';

const API = getApiBase();

export default function ProjectDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user: authUser, sessionId, refreshUser, loading: authLoading } = useAuth();
    const projectId = params?.id ? Number(params.id) : null;
    const isMmtUser = ['mmt', 'mmt_manager', 'mmt_executive'].includes((authUser?.role || '').toLowerCase());
    const viewDqc = searchParams.get('view') === 'dqc';
    const dqcStage = viewDqc ? (searchParams.get('stage') === 'dqc2' ? 'dqc2' as const : 'dqc1' as const) : null;
    const isDqcUser = ['dqc_manager', 'dqe'].includes((authUser?.role || '').toLowerCase());
    const isDesigner = ['designer', 'design_manager'].includes((authUser?.role || '').toLowerCase());
    
    // State to track WHICH card is maximized (null = none)
    const [activeCard, setActiveCard] = useState<string | null>(null);
    // Which milestone is "current" (shown alone when not maximized; highlighted when maximized). Next milestones are grayed.
    const [currentMilestoneIndex, setCurrentMilestoneIndex] = useState(0); // 0 = 1st, 1 = 2nd (DQC1), 2 = 3rd, 3 = D2 SITE MASKING, ...
    // Track which tasks are completed; next milestone unlocks only when all tasks in current milestone are done
    const [completedTaskKeys, setCompletedTaskKeys] = useState<string[]>([]);
    // Track which tasks that have checklists have had their checklist completed
    const [completedChecklistKeys, setCompletedChecklistKeys] = useState<string[]>([]);

    const taskKey = (milestoneIndex: number, taskName: string) => `${milestoneIndex}-${taskName}`;

    const markTaskComplete = (milestoneIndex: number, taskName: string) => {
        const key = taskKey(milestoneIndex, taskName);
        setCompletedTaskKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    };

    // Keep highlighted milestone in sync with persisted task completions (handles refresh and new tasks).
    useEffect(() => {
        const milestones = MileStonesArray.MilestonesName;
        let idx = 0;
        for (let i = 0; i < milestones.length; i++) {
            const m = milestones[i];
            const allDone = m.taskList.every((t: string) =>
                completedTaskKeys.includes(taskKey(i, t)),
            );
            if (!allDone) {
                idx = i;
                break;
            }
            idx = i + 1;
        }
        const last = milestones.length - 1;
        setCurrentMilestoneIndex(Math.min(Math.max(0, idx), last));
    }, [completedTaskKeys]);

    // Hydrate completed tasks for this lead from backend so milestone index matches server state
    useEffect(() => {
        if (!projectId || !sessionId) return;
        const headers: Record<string, string> = { Authorization: `Bearer ${sessionId}` };
        fetch(`${API}/api/leads/${projectId}/completions`, { headers })
            .then((res) => res.json())
            .then((data: { milestoneIndex: number; taskName: string }[]) => {
                if (!Array.isArray(data)) return;
                const keys = data.map((c) => taskKey(c.milestoneIndex, c.taskName));
                if (keys.length) {
                    setCompletedTaskKeys((prev) => {
                        // merge to avoid losing any local completions
                        const merged = new Set([...prev, ...keys]);
                        return Array.from(merged);
                    });
                }
            })
            .catch(() => {});
    }, [projectId, sessionId]);
    // Which milestone popup is open (null = closed). Lets you show different popup content per milestone/task.
    const [popupContext, setPopupContext] = useState<{ milestoneIndex: number; milestoneName: string; taskName: string } | null>(null);
    // Checklist popup (opened from "Visit checklist" in milestone task menu)
    const [checklistContext, setChecklistContext] = useState<{ milestoneIndex: number; milestoneName: string; taskName: string } | null>(null);
    // Brief message when user tries to open a task in a future milestone (e.g. "Complete the current milestone first")
    const [blockedTaskMessage, setBlockedTaskMessage] = useState<string | null>(null);
    const [dqc1Verdict, setDqc1Verdict] = useState<'approved' | 'approved_with_changes' | 'rejected' | null>(null);
    const [dqc1Remarks, setDqc1Remarks] = useState<QCRemark[]>([
        { id: 1, priority: 'high', text: 'Dimension Issue: Missing cabinet clearance dimensions on Wall B. The spacing between the refrigerator island and main counter seems insufficient for ADA compliance.', pinNumber: 1, xPct: 28, yPct: 35, page: 1 },
        { id: 2, priority: 'medium', text: 'Material Issue: Check backsplash material compatibility with induction heat specs. Quartz might require additional heat shielding behind the range area.', pinNumber: 2, xPct: 55, yPct: 52, page: 1 },
    ]);
    const [newRemarkText, setNewRemarkText] = useState('');
    const [newRemarkPriority, setNewRemarkPriority] = useState<'high' | 'medium' | 'low'>('medium');
    const [dqc1PdfFile, setDqc1PdfFile] = useState<File | null>(null);
    const [dqc1PdfUrl, setDqc1PdfUrl] = useState<string | null>(null);
    const [dqc1PdfMaximized, setDqc1PdfMaximized] = useState(false);
    const dqc1PdfInputRef = useRef<HTMLInputElement>(null);
    const [dqc1PdfNumPages, setDqc1PdfNumPages] = useState<number>(0);
    const [dqc1PdfPageNumber, setDqc1PdfPageNumber] = useState(1);
    const [dqc1AnnotateMode, setDqc1AnnotateMode] = useState(false);
    const [dqc1CommentPopup, setDqc1CommentPopup] = useState<{ xPct: number; yPct: number; page: number; docX?: number; docY?: number } | null>(null);
    const dqc1PdfViewportRef = useRef<HTMLDivElement>(null);
    const dqc1PdfScrollRef = useRef<HTMLDivElement>(null);
    const dqc1SubmissionBlobUrlRef = useRef<string | null>(null);
    const [dqc1SubmissionLoadError, setDqc1SubmissionLoadError] = useState<string | null>(null);
    const [dqc1SubmissionNotPdf, setDqc1SubmissionNotPdf] = useState(false);
    const [dqc1SubmissionLoading, setDqc1SubmissionLoading] = useState(false);
    const [dqcSubmissionFiles, setDqcSubmissionFiles] = useState<Array<{ id: number; originalName: string }>>([]);
    const [selectedDqcSubmissionFileId, setSelectedDqcSubmissionFileId] = useState<number | null>(null);
    const [dqc1SelectedPin, setDqc1SelectedPin] = useState<number | null>(null);
    const [dqc1HighlightedPin, setDqc1HighlightedPin] = useState<number | null>(null);
    // Design upload (First cut design popup): selected files
    const [designUploadFiles, setDesignUploadFiles] = useState<File[]>([]);
    const designFileInputRef = useRef<HTMLInputElement>(null);
    const milestoneCardsScrollRef = useRef<HTMLDivElement>(null);
    // Minutes of Meeting (meeting completed popup)
    const [momMinutes, setMomMinutes] = useState('');
    const [momReferenceFiles, setMomReferenceFiles] = useState<File[]>([]);
    const momFileInputRef = useRef<HTMLInputElement>(null);
    // Progress history: loaded from API and persisted when new events are added (recorded and maintained)
    const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
    const historyLeadIdRef = useRef<number | null>(null);
    const [showHoldModal, setShowHoldModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [prolanceBusy, setProlanceBusy] = useState(false);
    const [getQuoteBusy, setGetQuoteBusy] = useState(false);
    const [prolancePartnerId, setProlancePartnerId] = useState<number | null>(null);
    const [prolanceQuoteId, setProlanceQuoteId] = useState<number | null>(null);
    const [prolanceProjectId, setProlanceProjectId] = useState<number | null>(null);
    const [manualQuoteProjectId, setManualQuoteProjectId] = useState('');
    const [showGetQuoteModal, setShowGetQuoteModal] = useState(false);
    const [getQuoteLastStatus, setGetQuoteLastStatus] = useState<number | null>(null);
    const [getQuoteLastBody, setGetQuoteLastBody] = useState<unknown>(null);
    const [latestQuoteResponse, setLatestQuoteResponse] = useState<unknown>(null);
    const [showQuotePreviewModal, setShowQuotePreviewModal] = useState(false);
    const [quoteSummaryTab, setQuoteSummaryTab] = useState<'overall' | 'roomwise'>('overall');
    const [expandedQuoteRooms, setExpandedQuoteRooms] = useState<Record<string, boolean>>({});
    const [quoteLinkCopied, setQuoteLinkCopied] = useState(false);
    const [holdDate, setHoldDate] = useState<string>('');
    const [selectedHistoryEvent, setSelectedHistoryEvent] = useState<HistoryEvent | null>(null);
    const [uploadsVersion, setUploadsVersion] = useState(0);

    // Project/lead for this page: loaded from queue API (so sales-closure leads work) or fallback static list
    const staticProjects: LeadshipTypes[] = [
        { id: 1, pid: "P001", projectName: "Bharath D", projectStage: "Active", createAt: "2023-01-01T10:00:00.000Z", updateAt: "2023-01-02T14:30:00.000Z" },
        { id: 2, pid: "P002", projectName: "Shivram", projectStage: "Active", createAt: "2023-02-01T09:15:00.000Z", updateAt: "2023-02-02T11:00:00.000Z" },
        { id: 3, pid: "P003", projectName: "Gokulnath", projectStage: "Inactive", createAt: "2023-03-01T08:00:00.000Z", updateAt: "2023-03-02T16:45:00.000Z" },
        { id: 4, pid: "P004", projectName: "Riverside", projectStage: "20-60%", createAt: "2024-01-15T10:30:00.000Z", updateAt: "2024-02-01T09:00:00.000Z" },
        { id: 5, pid: "P005", projectName: "Downtown", projectStage: "10-20%", createAt: "2024-03-10T14:00:00.000Z", updateAt: "2024-04-05T11:20:00.000Z" },
    ];
    const [project, setProject] = useState<LeadshipTypes | null>(null);
    const [projectLoaded, setProjectLoaded] = useState(false);

    const extractString = (v: unknown): string | null =>
        typeof v === 'string' && v.trim() ? v.trim() : null;

    const extractNumber = (v: unknown): number | null => {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
        return null;
    };

    const formatCurrency = (v: unknown): string => {
        const n = extractNumber(v);
        if (n == null) return '-';
        return `Rs ${n.toLocaleString('en-IN')}`;
    };

    const prettyResponse = (v: unknown): string => {
        if (typeof v === 'string') return v;
        try {
            return JSON.stringify(v, null, 2);
        } catch {
            return String(v ?? '');
        }
    };

    const extractProjectId = (v: unknown): number | null => {
        if (!v || typeof v !== 'object') return null;
        const root = v as Record<string, unknown>;
        const direct = root.projectID ?? root.projectId;
        if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
        if (typeof direct === 'string' && direct.trim() && Number.isFinite(Number(direct))) return Number(direct);
        const arr = root.data;
        if (Array.isArray(arr) && arr[0] && typeof arr[0] === 'object') {
            const first = arr[0] as Record<string, unknown>;
            const nested = first.projectID ?? first.projectId;
            if (typeof nested === 'number' && Number.isFinite(nested)) return nested;
            if (typeof nested === 'string' && nested.trim() && Number.isFinite(Number(nested))) return Number(nested);
        }
        return null;
    };

    const extractQuoteId = (v: unknown): number | null => {
        if (!v || typeof v !== 'object') return null;
        const root = v as Record<string, unknown>;
        const direct = root.quoteID ?? root.quoteId ?? root.quotationId ?? root.quotationID;
        if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
        if (typeof direct === 'string' && direct.trim() && Number.isFinite(Number(direct))) return Number(direct);
        const arr = root.data;
        if (Array.isArray(arr) && arr[0] && typeof arr[0] === 'object') {
            const first = arr[0] as Record<string, unknown>;
            const nested = first.quoteID ?? first.quoteId ?? first.quotationId ?? first.quotationID;
            if (typeof nested === 'number' && Number.isFinite(nested)) return nested;
            if (typeof nested === 'string' && nested.trim() && Number.isFinite(Number(nested))) return Number(nested);
        }
        return null;
    };

    const hasQuotePricingDetails = (v: unknown): boolean => {
        if (!v || typeof v !== 'object') return false;
        const root = v as Record<string, unknown>;
        const first =
            Array.isArray(root.data) && root.data[0] && typeof root.data[0] === 'object'
                ? (root.data[0] as Record<string, unknown>)
                : null;
        const obj = first || root;
        const options = obj.quoteOptionsData || root.quoteOptionsData;
        if (Array.isArray(options) && options.length > 0) return true;
        const hasTotals =
            extractNumber(obj.totalPayableAmount ?? root.totalPayableAmount ?? obj.finalTotalPrice ?? root.finalTotalPrice) != null ||
            extractNumber(obj.interiorProjectAmount ?? root.interiorProjectAmount ?? obj.totalPrice ?? root.totalPrice) != null;
        return hasTotals;
    };

    const parseLeadPayload = (raw: unknown): Record<string, unknown> | null => {
        if (!raw) return null;
        if (typeof raw === 'object') return raw as Record<string, unknown>;
        if (typeof raw !== 'string') return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
        } catch {
            return null;
        }
    };

    const deepFindByKeys = (value: unknown, keys: string[]): unknown => {
        const normalizedKeys = keys.map((k) => k.toLowerCase());
        const seen = new Set<unknown>();
        const queue: unknown[] = [value];
        while (queue.length) {
            const current = queue.shift();
            if (!current || seen.has(current)) continue;
            seen.add(current);
            if (Array.isArray(current)) {
                for (const item of current) queue.push(item);
                continue;
            }
            if (typeof current !== 'object') continue;
            const obj = current as Record<string, unknown>;
            for (const [k, v] of Object.entries(obj)) {
                if (normalizedKeys.includes(k.toLowerCase()) && v != null) return v;
                if (v && (typeof v === 'object' || Array.isArray(v))) queue.push(v);
            }
        }
        return null;
    };

    const normalizeQuoteView = (
        payload: unknown,
        leadFallback?: {
            customerName?: string | null;
            refId?: string | null;
            city?: string | null;
            bhkType?: string | null;
            projectType?: string | null;
            partnerId?: string | number | null;
        },
    ) => {
        const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
        const dataArray = Array.isArray(root.data) ? root.data : [];
        const dataObject =
            root.data && typeof root.data === 'object' && !Array.isArray(root.data)
                ? (root.data as Record<string, unknown>)
                : null;
        const firstData =
            dataArray.length > 0 && dataArray[0] && typeof dataArray[0] === 'object'
                ? (dataArray[0] as Record<string, unknown>)
                : {};
        const quoteObj = Object.keys(firstData).length
            ? firstData
            : dataObject && Object.keys(dataObject).length
                ? dataObject
                : root;

        const pick = (...keys: string[]) => {
            for (const k of keys) {
                if (k in quoteObj) return quoteObj[k];
                if (k in root) return root[k];
            }
            const deep = deepFindByKeys(payload, keys);
            if (deep != null) return deep;
            return null;
        };

        const quotationId = pick('quotationId', 'quotationID', 'quoteID', 'quoteId');
        const quoteNum = pick('quoteNum', 'quoteNo', 'quotationNum');
        const projectId = pick('projectID', 'projectId');
        const partnerId = pick('partnerID', 'partnerId');
        const remarks = pick('remarks');
        const createdOn = pick('createdOn', 'createdAt');
        const finalTotalPrice = pick('finalTotalPrice', 'finalPrice', 'netPayable');
        const totalPrice = pick('totalPrice', 'grossTotalPrice');
        const discount = pick('discount', 'discountAmount');
        const downloadURL = pick('downloadURL', 'downloadUrl');
        const woodWorkFactor = pick('woodWorkFactor');
        const accessoriesFactor = pick('accessoriesFactor');
        const hardwareFactor = pick('hardwareFactor');
        const appliancesFactor = pick('appliancesFactor');
        const servicesFactor = pick('servicesFactor');
        const worktopFactor = pick('worktopFactor');
        const customerName = pick('customer', 'customerName', 'name');
        const refId = pick('refId', 'referenceId', 'leadRefId');
        const city = pick('city', 'customerCity');
        const bhkType = pick('bhkType', 'BHKType', 'bhk');
        const projectType = pick('projectType', 'pType', 'type');

        const quoteOptionsRaw =
            (quoteObj.quoteOptionsData as unknown) ||
            (root.quoteOptionsData as unknown) ||
            (isPlainObject(quoteObj.data) ? (quoteObj.data as Record<string, unknown>).quoteOptionsData : null) ||
            deepFindByKeys(payload, ['quoteOptionsData', 'roomWiseSummary', 'optionsData', 'optionDetails']);
        const quoteOptionsData = Array.isArray(quoteOptionsRaw)
            ? (quoteOptionsRaw
                  .map((item) => {
                      if (!item || typeof item !== 'object') return null;
                      const o = item as Record<string, unknown>;
                      const appliancesPrice = extractNumber(o.appliancesPrice);
                      const worktopsPrice = extractNumber(o.worktopsPrice);
                      const servicesPrice = extractNumber(o.servicesPrice);
                      const unitsPrice = extractNumber(o.unitsPrice ?? o.woodWorkPrice);
                      const units = Array.isArray(o.units) ? (o.units as Record<string, unknown>[]) : [];
                      const lofts = Array.isArray(o.lofts) ? (o.lofts as Record<string, unknown>[]) : [];
                      const worktops = Array.isArray(o.worktops) ? (o.worktops as Record<string, unknown>[]) : [];
                      const skirts = Array.isArray(o.skirts) ? (o.skirts as Record<string, unknown>[]) : [];
                      const appliances = Array.isArray(o.appliances) ? (o.appliances as Record<string, unknown>[]) : [];
                      const hardwares = Array.isArray(o.hardwares) ? (o.hardwares as Record<string, unknown>[]) : [];
                      const decors = Array.isArray(o.decors) ? (o.decors as Record<string, unknown>[]) : [];
                      const services = Array.isArray(o.services) ? (o.services as Record<string, unknown>[]) : [];
                      const sumPrice = (arr: Record<string, unknown>[]) =>
                          arr.reduce((sum, item) => sum + (extractNumber(item.price) || 0), 0);
                      const detailedRoomTotal = [
                          sumPrice(units),
                          sumPrice(lofts),
                          sumPrice(worktops),
                          sumPrice(skirts),
                          sumPrice(appliances),
                          sumPrice(services),
                          sumPrice(hardwares),
                          sumPrice(decors),
                      ].reduce((a, b) => a + b, 0);
                      const directRoomBucketTotal =
                          (unitsPrice || 0) +
                          (servicesPrice || 0) +
                          (worktopsPrice || 0) +
                          (appliancesPrice || 0) +
                          (extractNumber(o.skirtingsPrice) || 0);
                      // Prolance space row often matches BOQ line sums; `totalPrice` / `unitsPrice` can be a higher aggregate.
                      const explicitNetTotal = extractNumber(
                          o.netPrice ??
                              o.finalPrice ??
                              o.roomTotal ??
                              o.optionTotal ??
                              o.payableAmount ??
                              o.discountedTotal ??
                              o.netOptionPrice,
                      );
                      return {
                          qoid: extractNumber(o.qoid),
                          quoteID: extractNumber(o.quoteID ?? o.quoteId),
                          optionID: extractNumber(o.optionID ?? o.optionId),
                          roomID: extractNumber(o.roomID ?? o.roomId),
                          roomName: extractString(o.roomName) || '-',
                          optionName: extractString(o.optionName ?? o.roomType) || '-',
                          totalPrice:
                              explicitNetTotal ??
                              extractNumber(o.totalPrice) ??
                              (detailedRoomTotal > 0 ? Math.round(detailedRoomTotal) : null) ??
                              (directRoomBucketTotal > 0 ? Math.round(directRoomBucketTotal) : null),
                          totalPriceOld:
                              extractNumber(o.totalPriceOld ?? o.unitsPrice ?? o.woodWorkPrice),
                          unitsPrice,
                          loftsPrice: extractNumber(o.loftsPrice),
                          servicesPrice,
                          appliancesPrice: extractNumber(o.appliancesPrice),
                          skirtingsPrice: extractNumber(o.skirtingsPrice),
                          worktopsPrice: extractNumber(o.worktopsPrice),
                          additionalHWPrice: extractNumber(o.additionalHWPrice),
                          matlInfo: extractString(o.matlInfo) || '',
                          roomRev: extractString(o.roomRev) || '',
                          units: units.map((u) => ({
                              label: extractString(u.label) || '-',
                              cabinetClass: extractString(u.cabinetClass) || '-',
                              description: extractString(u.description) || '-',
                              dimensions: extractString(u.dimensions) || '-',
                              price: extractNumber(u.price),
                          })),
                          lofts: lofts.map((l) => ({
                              description: extractString(l.description) || '-',
                              dimensions: extractString(l.dimensions) || '-',
                              price: extractNumber(l.price),
                          })),
                          servicesList: services.map((s) => ({
                              category: extractString(s.category) || '-',
                              description: extractString(s.description) || '-',
                              qty: extractNumber(s.qty),
                              uom: extractString(s.uom) || '-',
                              price: extractNumber(s.price),
                          })),
                      };
                  })
                  .filter(Boolean) as Array<{
                  qoid: number | null;
                  quoteID: number | null;
                  optionID: number | null;
                  roomID: number | null;
                  roomName: string;
                  optionName: string;
                  totalPrice: number | null;
                  totalPriceOld: number | null;
                  unitsPrice: number | null;
                  loftsPrice: number | null;
                  servicesPrice: number | null;
                  appliancesPrice: number | null;
                  skirtingsPrice: number | null;
                  worktopsPrice: number | null;
                  additionalHWPrice: number | null;
                  matlInfo: string;
                  roomRev: string;
                  units: Array<{ label: string; cabinetClass: string; description: string; dimensions: string; price: number | null }>;
                  lofts: Array<{ description: string; dimensions: string; price: number | null }>;
                  servicesList: Array<{ category: string; description: string; qty: number | null; uom: string; price: number | null }>;
              }>)
            : [];

        const candidateListKeys = [
            'summary',
            'summaryDetails',
            'lineItems',
            'items',
            'roomWiseSummary',
            'overallSummary',
            'quoteDetails',
            'details',
        ];
        let lineItems: Array<{ name: string; amount: number | null; discountedAmount: number | null }> = [];
        for (const key of candidateListKeys) {
            const arr = quoteObj[key] || root[key];
            if (Array.isArray(arr)) {
                lineItems = arr
                    .map((x) => {
                        if (!x || typeof x !== 'object') return null;
                        const o = x as Record<string, unknown>;
                        const name =
                            extractString(o.name) ||
                            extractString(o.itemName) ||
                            extractString(o.title) ||
                            extractString(o.roomName);
                        if (!name) return null;
                        return {
                            name,
                            amount: extractNumber(o.amount ?? o.baseAmount ?? o.totalAmount),
                            discountedAmount: extractNumber(o.discountedAmount ?? o.finalAmount ?? o.payableAmount),
                        };
                    })
                    .filter((x): x is { name: string; amount: number; discountedAmount: number | null } => x !== null);
                if (lineItems.length) break;
            }
        }

        // Fallback: build a user-friendly list from object arrays that look like line items.
        if (!lineItems.length) {
            const values = [quoteObj, root]
                .flatMap((o) => Object.values(o))
                .filter((v) => Array.isArray(v)) as unknown[];
            for (const arrAny of values) {
                const arr = arrAny as unknown[];
                const mapped = arr
                    .map((x) => {
                        if (!x || typeof x !== 'object') return null;
                        const o = x as Record<string, unknown>;
                        const name =
                            extractString(o.name) ||
                            extractString(o.itemName) ||
                            extractString(o.title) ||
                            extractString(o.description) ||
                            extractString(o.roomName) ||
                            extractString(o.moduleName);
                        const amount = extractNumber(o.amount ?? o.baseAmount ?? o.totalAmount ?? o.price ?? o.value);
                        if (!name || amount == null) return null;
                        return {
                            name,
                            amount,
                            discountedAmount: extractNumber(o.discountedAmount ?? o.finalAmount ?? o.payableAmount ?? o.netAmount),
                        };
                    });
                const cleaned = mapped.filter(Boolean) as Array<{
                    name: string;
                    amount: number | null;
                    discountedAmount: number | null;
                }>;
                if (cleaned.length) {
                    lineItems = cleaned;
                    break;
                }
            }
        }

        // Fallback: derive overall summary from room-wise quote options.
        if (!lineItems.length && quoteOptionsData.length) {
            lineItems = quoteOptionsData.map((opt) => ({
                name: opt.roomName !== '-' ? opt.roomName : opt.optionName,
                amount: opt.totalPriceOld,
                discountedAmount: opt.totalPrice,
            }));
        }

        const optionDetails = Array.isArray(quoteObj.optionDetails)
            ? (quoteObj.optionDetails as Record<string, unknown>[])
            : [];
        const optionDetailsTotal = quoteOptionsData.reduce((sum, opt) => sum + (extractNumber(opt.totalPrice) || 0), 0);
        const computedInteriorAmount = optionDetails.reduce((sum, item) => {
            const units = extractNumber(item.unitsPrice) || 0;
            return sum + units;
        }, 0);
        const computedDiscountFromFactors =
            (optionDetails.reduce((sum, item) => sum + (extractNumber(item.woodWorkPrice) || 0), 0) *
                ((extractNumber(quoteObj.woodWorkDiscount) || 0) / 100)) +
            (optionDetails.reduce((sum, item) => sum + (extractNumber(item.accessoriesPrice) || 0), 0) *
                ((extractNumber(quoteObj.accessoriesDiscount) || 0) / 100)) +
            (optionDetails.reduce((sum, item) => sum + (extractNumber(item.servicesPrice) || 0), 0) *
                ((extractNumber(quoteObj.servicesDiscount) || 0) / 100)) +
            (extractNumber(quoteObj.flatDiscount) || 0);

        const interiorProjectAmountRaw =
            pick('interiorProjectAmount', 'projectAmount', 'subTotal', 'totalPrice', 'grossAmount') ??
            (computedInteriorAmount > 0 ? computedInteriorAmount : null);
        const totalPayableAmountRaw =
            pick('totalPayableAmount', 'totalPayable', 'grandTotal', 'netPayable', 'finalTotalPrice', 'totalAmount') ??
            (optionDetailsTotal > 0 ? optionDetailsTotal : null);
        const discountRaw =
            pick('discount', 'discountAmount') ?? (computedDiscountFromFactors > 0 ? computedDiscountFromFactors : null);
        const interiorProjectAmountNum = extractNumber(interiorProjectAmountRaw);
        const totalPayableAmountNum = extractNumber(totalPayableAmountRaw);
        const discountNum = extractNumber(discountRaw);
        const computedDiscount =
            interiorProjectAmountNum != null && totalPayableAmountNum != null
                ? Math.max(0, interiorProjectAmountNum - totalPayableAmountNum)
                : null;
        const effectiveDiscount =
            discountNum != null && discountNum > 0
                ? discountNum
                : computedDiscount;

        const totals = {
            interiorProjectAmount: interiorProjectAmountRaw,
            designAndManagementFees: pick('designAndManagementFees', 'designFee', 'managementFee', 'servicesPrice'),
            discount: effectiveDiscount,
            totalPayableAmount: totalPayableAmountRaw,
        };

        return {
            quotationId: extractString(quotationId) || (extractNumber(quotationId) != null ? String(extractNumber(quotationId)) : '-'),
            quoteNum: extractString(quoteNum) || (extractNumber(quoteNum) != null ? String(extractNumber(quoteNum)) : '-'),
            projectId: extractString(projectId) || (extractNumber(projectId) != null ? String(extractNumber(projectId)) : '-'),
            customerName: extractString(customerName) || extractString(leadFallback?.customerName) || '-',
            refId: extractString(refId) || extractString(leadFallback?.refId) || '-',
            city: extractString(city) || extractString(leadFallback?.city) || '-',
            bhkType: extractString(bhkType) || extractString(leadFallback?.bhkType) || '-',
            projectType: extractString(projectType) || extractString(leadFallback?.projectType) || '-',
            quoteMeta: {
                partnerId: extractString(partnerId) || (extractNumber(partnerId) != null ? String(extractNumber(partnerId)) : '-'),
                remarks: extractString(remarks) || '-',
                createdOn: extractString(createdOn) || '-',
                downloadURL: extractString(downloadURL) || '-',
                totalPrice,
                finalTotalPrice,
                discount,
                computedDiscount: effectiveDiscount,
                woodWorkFactor,
                accessoriesFactor,
                hardwareFactor,
                appliancesFactor,
                servicesFactor,
                worktopFactor,
            },
            lineItems,
            quoteOptionsData,
            totals,
            leadFallback,
            rawQuoteId: extractNumber(quotationId),
        };
    };

    const isPlainObject = (v: unknown): v is Record<string, unknown> =>
        Boolean(v) && typeof v === 'object' && !Array.isArray(v);

    const humanizeKey = (key: string): string =>
        key
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^./, (s) => s.toUpperCase());

    const renderPrimitive = (value: unknown) => {
        if (value === null || value === undefined || value === '') return '-';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') return value.toLocaleString('en-IN');
        return String(value);
    };

    const renderResponseValue = (value: unknown, path: string, depth = 0): React.ReactNode => {
        if (depth > 3) {
            return (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                    Nested data available
                </div>
            );
        }

        if (!isPlainObject(value) && !Array.isArray(value)) {
            return <span className="text-sm text-gray-900">{renderPrimitive(value)}</span>;
        }

        if (Array.isArray(value)) {
            if (!value.length) {
                return <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">No items</div>;
            }
            const allPrimitive = value.every((item) => !isPlainObject(item) && !Array.isArray(item));
            if (allPrimitive) {
                return (
                    <div className="flex flex-wrap gap-2">
                        {value.map((item, idx) => (
                            <span key={`${path}-${idx}`} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                                {renderPrimitive(item)}
                            </span>
                        ))}
                    </div>
                );
            }

            const objectRows = value.filter(isPlainObject);
            if (objectRows.length === value.length) {
                const columns = Array.from(
                    new Set(objectRows.flatMap((row) => Object.keys(row)).slice(0, 50)),
                ).slice(0, 8);
                return (
                    <div className="overflow-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                                <tr>
                                    {columns.map((col) => (
                                        <th key={`${path}-h-${col}`} className="px-3 py-2 text-left font-semibold">
                                            {humanizeKey(col)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {objectRows.map((row, rowIdx) => (
                                    <tr key={`${path}-r-${rowIdx}`} className="border-t border-gray-100">
                                        {columns.map((col) => {
                                            const cell = row[col];
                                            const isSimple = !isPlainObject(cell) && !Array.isArray(cell);
                                            return (
                                                <td key={`${path}-c-${rowIdx}-${col}`} className="px-3 py-2 align-top text-gray-800">
                                                    {isSimple ? renderPrimitive(cell) : 'Details'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }

            return (
                <div className="space-y-2">
                    {value.map((item, idx) => (
                        <div key={`${path}-item-${idx}`} className="rounded-lg border border-gray-200 p-3">
                            {renderResponseValue(item, `${path}.${idx}`, depth + 1)}
                        </div>
                    ))}
                </div>
            );
        }

        const entries = Object.entries(value);
        const scalarEntries = entries.filter(([, v]) => !isPlainObject(v) && !Array.isArray(v));
        const nestedEntries = entries.filter(([, v]) => isPlainObject(v) || Array.isArray(v));

        return (
            <div className="space-y-3">
                {!!scalarEntries.length && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {scalarEntries.map(([k, v]) => (
                            <div key={`${path}-s-${k}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-gray-500">{humanizeKey(k)}</p>
                                <p className="mt-1 text-sm font-medium text-gray-900">{renderPrimitive(v)}</p>
                            </div>
                        ))}
                    </div>
                )}
                {nestedEntries.map(([k, v]) => (
                    <div key={`${path}-n-${k}`} className="rounded-lg border border-gray-200 p-3">
                        <p className="mb-2 text-xs font-semibold text-gray-600">{humanizeKey(k)}</p>
                        {renderResponseValue(v, `${path}.${k}`, depth + 1)}
                    </div>
                ))}
            </div>
        );
    };

    const triggerProlanceCreate = async () => {
        if (!sessionId || !project) {
            setBlockedTaskMessage('Please sign in and load project details first.');
            setTimeout(() => setBlockedTaskMessage(null), 3000);
            return;
        }
        const payloadObj = parseLeadPayload((project as unknown as Record<string, unknown>)?.payload);
        const formData = (payloadObj?.formData && typeof payloadObj.formData === 'object'
            ? (payloadObj.formData as Record<string, unknown>)
            : null);

        const payload = {
            partnerID:
                Number(
                    (project as unknown as Record<string, unknown>)?.partnerID ||
                        formData?.partnerID ||
                        payloadObj?.partnerID ||
                        23226,
                ) || 23226,
            pName: extractString(project.projectName) || 'Untitled Project',
            customer:
                extractString((project as unknown as Record<string, unknown>)?.customer) ||
                extractString(formData?.customer_name) ||
                extractString(formData?.sales_lead_name) ||
                extractString(project.projectName) ||
                'Customer',
            city:
                extractString((project as unknown as Record<string, unknown>)?.city) ||
                extractString(formData?.city) ||
                'Bengaluru',
            state:
                extractString((project as unknown as Record<string, unknown>)?.state) ||
                extractString(formData?.state) ||
                'Karnataka',
            projectType:
                extractString((project as unknown as Record<string, unknown>)?.projectType) ||
                extractString(formData?.projectType) ||
                'CYO',
        };

        try {
            setProlanceBusy(true);
            const appHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sessionId}`,
            };

            // 1) Generate Prolance API token (uses backend env creds if body is empty)
            const tokenRes = await fetch(`${API}/api/prolance-test/token`, {
                method: 'POST',
                headers: appHeaders,
                body: JSON.stringify({}),
            });
            const tokenText = await tokenRes.text();
            let tokenBody: any = null;
            try { tokenBody = tokenText ? JSON.parse(tokenText) : null; } catch { tokenBody = tokenText; }
            const prolanceToken =
                (tokenBody && typeof tokenBody === 'object' && (tokenBody.access_token || tokenBody.accessToken || tokenBody.token)) || '';
            if (!tokenRes.ok || !String(prolanceToken).trim()) {
                const msg =
                    (tokenBody && typeof tokenBody === 'object' && (tokenBody.message || tokenBody.error)) ||
                    'Failed to generate Prolance token.';
                setBlockedTaskMessage(String(msg));
                setTimeout(() => setBlockedTaskMessage(null), 5000);
                return;
            }

            // 2) Partner login to get OriginSessionID / PartnerID
            const partnerHeaders: Record<string, string> = {
                ...appHeaders,
                'X-Prolance-Token': String(prolanceToken).trim(),
            };
            const partnerRes = await fetch(`${API}/api/prolance-test/partners/login`, {
                method: 'POST',
                headers: partnerHeaders,
                body: JSON.stringify({}),
            });
            const partnerText = await partnerRes.text();
            let partnerBody: any = null;
            try { partnerBody = partnerText ? JSON.parse(partnerText) : null; } catch { partnerBody = partnerText; }
            const partnerData0 =
                partnerBody && typeof partnerBody === 'object' && Array.isArray(partnerBody.data) ? partnerBody.data[0] : null;
            const originSessionID =
                (partnerData0 && typeof partnerData0 === 'object' && (partnerData0.sessionID || partnerData0.sessionId)) || '';
            const partnerIDFromLogin =
                (partnerData0 && typeof partnerData0 === 'object' && (partnerData0.partnerID || partnerData0.partnerId)) || null;
            if (partnerIDFromLogin != null && Number.isFinite(Number(partnerIDFromLogin))) {
                setProlancePartnerId(Number(partnerIDFromLogin));
            }
            if (!partnerRes.ok || !String(originSessionID).trim()) {
                const msg =
                    (partnerBody && typeof partnerBody === 'object' && (partnerBody.message || partnerBody.error)) ||
                    'Failed to login partner / fetch origin session.';
                setBlockedTaskMessage(String(msg));
                setTimeout(() => setBlockedTaskMessage(null), 5000);
                return;
            }

            // Prefer partnerID returned by login when available.
            if (partnerIDFromLogin != null && Number(partnerIDFromLogin)) {
                payload.partnerID = Number(partnerIDFromLogin);
            }

            // 3) Create project
            const createHeaders: Record<string, string> = {
                ...appHeaders,
                'X-Prolance-Token': String(prolanceToken).trim(),
                'X-Prolance-Origin-Session': String(originSessionID).trim(),
            };
            const res = await fetch(`${API}/api/prolance-test/projects/create`, {
                method: 'PUT',
                headers: createHeaders,
                body: JSON.stringify(payload),
            });
            const txt = await res.text();
            let body: any = null;
            try { body = txt ? JSON.parse(txt) : null; } catch { body = txt; }
            if (res.ok) {
                const createdProjectId = extractProjectId(body);
                if (createdProjectId != null) setProlanceProjectId(createdProjectId);
                setBlockedTaskMessage(
                    createdProjectId != null
                        ? `Prolance create project triggered (Project ID: ${createdProjectId}).`
                        : 'Prolance create project triggered successfully.',
                );
                setTimeout(() => setBlockedTaskMessage(null), 3500);
            } else {
                const msg =
                    (body && typeof body === 'object' && (body.message || body.error)) ||
                    `Create project failed (HTTP ${res.status}).`;
                setBlockedTaskMessage(String(msg));
                setTimeout(() => setBlockedTaskMessage(null), 5000);
            }
        } catch {
            setBlockedTaskMessage('Failed to trigger Prolance create project.');
            setTimeout(() => setBlockedTaskMessage(null), 4000);
        } finally {
            setProlanceBusy(false);
        }
    };

    const triggerProlanceGetQuote = async (explicitProjectId?: number | null) => {
        if (!sessionId) {
            setBlockedTaskMessage('Please sign in first.');
            setTimeout(() => setBlockedTaskMessage(null), 3000);
            return;
        }
        const quoteProjectId = explicitProjectId || Number((manualQuoteProjectId || '').trim()) || prolanceProjectId;
        if (!quoteProjectId) {
            setBlockedTaskMessage('Project ID missing. Click Prolance first to create a project.');
            setTimeout(() => setBlockedTaskMessage(null), 4000);
            return;
        }

        try {
            setGetQuoteBusy(true);
            const appHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sessionId}`,
            };

            const tokenRes = await fetch(`${API}/api/prolance-test/token`, {
                method: 'POST',
                headers: appHeaders,
                body: JSON.stringify({}),
            });
            const tokenText = await tokenRes.text();
            let tokenBody: any = null;
            try { tokenBody = tokenText ? JSON.parse(tokenText) : null; } catch { tokenBody = tokenText; }
            const prolanceToken =
                (tokenBody && typeof tokenBody === 'object' && (tokenBody.access_token || tokenBody.accessToken || tokenBody.token)) || '';
            if (!tokenRes.ok || !String(prolanceToken).trim()) {
                const msg =
                    (tokenBody && typeof tokenBody === 'object' && (tokenBody.message || tokenBody.error)) ||
                    'Failed to generate Prolance token.';
                setBlockedTaskMessage(String(msg));
                setTimeout(() => setBlockedTaskMessage(null), 5000);
                return;
            }

            const partnerRes = await fetch(`${API}/api/prolance-test/partners/login`, {
                method: 'POST',
                headers: {
                    ...appHeaders,
                    'X-Prolance-Token': String(prolanceToken).trim(),
                },
                body: JSON.stringify({}),
            });
            const partnerText = await partnerRes.text();
            let partnerBody: any = null;
            try { partnerBody = partnerText ? JSON.parse(partnerText) : null; } catch { partnerBody = partnerText; }
            const partnerData0 =
                partnerBody && typeof partnerBody === 'object' && Array.isArray(partnerBody.data) ? partnerBody.data[0] : null;
            const originSessionID =
                (partnerData0 && typeof partnerData0 === 'object' && (partnerData0.sessionID || partnerData0.sessionId)) || '';
            const partnerIDFromLogin =
                (partnerData0 && typeof partnerData0 === 'object' && (partnerData0.partnerID || partnerData0.partnerId)) || null;
            if (partnerIDFromLogin != null && Number.isFinite(Number(partnerIDFromLogin))) {
                setProlancePartnerId(Number(partnerIDFromLogin));
            }
            if (!partnerRes.ok || !String(originSessionID).trim()) {
                const msg =
                    (partnerBody && typeof partnerBody === 'object' && (partnerBody.message || partnerBody.error)) ||
                    'Failed to login partner / fetch origin session.';
                setBlockedTaskMessage(String(msg));
                setTimeout(() => setBlockedTaskMessage(null), 5000);
                return;
            }

            const quoteRes = await fetch(
                `${API}/api/prolance-test/quotes/${encodeURIComponent(String(quoteProjectId))}`,
                {
                    method: 'GET',
                    headers: {
                        ...appHeaders,
                        'X-Prolance-Token': String(prolanceToken).trim(),
                        'X-Prolance-Origin-Session': String(originSessionID).trim(),
                    },
                },
            );
            const quoteText = await quoteRes.text();
            let quoteBody: any = null;
            try { quoteBody = quoteText ? JSON.parse(quoteText) : null; } catch { quoteBody = quoteText; }
            let effectiveStatus = quoteRes.status;
            const quoteIdFromGetQuote = extractQuoteId(quoteBody);
            if (quoteIdFromGetQuote != null) {
                setProlanceQuoteId(quoteIdFromGetQuote);
            }

            // Always call FullDetails endpoint after base quote call.
            // Use quote_id generated by Get Quote API for the FullDetails call.
            if (quoteIdFromGetQuote != null) {
                const fullRes = await fetch(
                    `${API}/api/prolance-test/quotes/full-details/${encodeURIComponent(String(quoteIdFromGetQuote))}`,
                    {
                        method: 'GET',
                        headers: {
                            ...appHeaders,
                            'X-Prolance-Token': String(prolanceToken).trim(),
                            'X-Prolance-Origin-Session': String(originSessionID).trim(),
                        },
                    },
                );
                const fullText = await fullRes.text();
                let fullBody: any = null;
                try { fullBody = fullText ? JSON.parse(fullText) : null; } catch { fullBody = fullText; }
                if (fullRes.ok && fullBody) {
                    // Keep room totals from /quotes payload (matches Prolance summary),
                    // but hydrate with FullDetails for units/material breakdown.
                    const baseQuoteData =
                        quoteBody && typeof quoteBody === 'object' && Array.isArray(quoteBody.data) ? quoteBody.data[0] : null;
                    const baseQuoteOptionsData =
                        baseQuoteData && typeof baseQuoteData === 'object' && Array.isArray(baseQuoteData.quoteOptionsData)
                            ? baseQuoteData.quoteOptionsData
                            : null;
                    if (
                        fullBody &&
                        typeof fullBody === 'object' &&
                        fullBody.data &&
                        typeof fullBody.data === 'object' &&
                        Array.isArray(baseQuoteOptionsData) &&
                        baseQuoteOptionsData.length > 0
                    ) {
                        const baseByOptionKey = new Map<string, any>();
                        baseQuoteOptionsData.forEach((item: any, idx: number) => {
                            const optionKey =
                                (item && (item.optionID ?? item.optionId ?? item.roomID ?? item.roomId)) != null
                                    ? String(item.optionID ?? item.optionId ?? item.roomID ?? item.roomId)
                                    : `idx-${idx}`;
                            baseByOptionKey.set(optionKey, item);
                        });
                        const fullOptionsData = Array.isArray((fullBody.data as any).quoteOptionsData)
                            ? (fullBody.data as any).quoteOptionsData
                            : Array.isArray((fullBody.data as any).optionDetails)
                                ? (fullBody.data as any).optionDetails
                                : [];
                        const mergedOptionsData = fullOptionsData.map((item: any, idx: number) => {
                            const optionKey =
                                (item && (item.optionID ?? item.optionId ?? item.roomID ?? item.roomId)) != null
                                    ? String(item.optionID ?? item.optionId ?? item.roomID ?? item.roomId)
                                    : `idx-${idx}`;
                            const baseItem = baseByOptionKey.get(optionKey);
                            if (!baseItem || typeof baseItem !== 'object') return item;
                            return {
                                ...item,
                                // Keep detailed FullDetails fields (units/matlInfo/etc),
                                // but use summary pricing from /quotes endpoint to match Prolance cards.
                                totalPrice: baseItem.totalPrice ?? item.totalPrice,
                                totalPriceOld: baseItem.totalPriceOld ?? item.totalPriceOld,
                                unitsPrice: baseItem.unitsPrice ?? item.unitsPrice,
                                loftsPrice: baseItem.loftsPrice ?? item.loftsPrice,
                                servicesPrice: baseItem.servicesPrice ?? item.servicesPrice,
                                appliancesPrice: baseItem.appliancesPrice ?? item.appliancesPrice,
                                skirtingsPrice: baseItem.skirtingsPrice ?? item.skirtingsPrice,
                                worktopsPrice: baseItem.worktopsPrice ?? item.worktopsPrice,
                                additionalHWPrice: baseItem.additionalHWPrice ?? item.additionalHWPrice,
                            };
                        });
                        if (mergedOptionsData.length > 0) {
                            quoteBody = {
                                ...fullBody,
                                data: {
                                    ...(fullBody.data as Record<string, unknown>),
                                    quoteOptionsData: mergedOptionsData,
                                },
                            };
                        } else {
                            quoteBody = fullBody;
                        }
                    } else {
                        quoteBody = fullBody;
                    }
                    effectiveStatus = fullRes.status;
                } else if (!quoteRes.ok && fullRes.ok && fullBody) {
                    quoteBody = fullBody;
                    effectiveStatus = fullRes.status;
                } else if (!hasQuotePricingDetails(quoteBody) && fullBody) {
                    // Preserve full-details error/debug body when base response has no pricing data.
                    quoteBody = fullBody;
                    effectiveStatus = fullRes.status;
                }
            }

            setGetQuoteLastStatus(effectiveStatus);
            setGetQuoteLastBody(quoteBody);
            const quoteSucceeded = effectiveStatus >= 200 && effectiveStatus < 300;
            if (quoteSucceeded) {
                setLatestQuoteResponse(quoteBody);
                setQuoteSummaryTab('overall');
                setExpandedQuoteRooms({});
                setShowQuotePreviewModal(false);
                const redirectQuoteId = extractQuoteId(quoteBody) ?? quoteIdFromGetQuote;
                if (redirectQuoteId != null) {
                    window.open(`/quote/${encodeURIComponent(String(redirectQuoteId))}?internal=1`, '_blank');
                } else {
                    setShowQuotePreviewModal(true);
                }
                setBlockedTaskMessage(`Get quote triggered successfully for Project ID ${quoteProjectId}.`);
                setTimeout(() => setBlockedTaskMessage(null), 3500);
            } else {
                const msg =
                    (quoteBody && typeof quoteBody === 'object' && (quoteBody.message || quoteBody.error)) ||
                    `Get quote failed (HTTP ${effectiveStatus}).`;
                setBlockedTaskMessage(String(msg));
                setTimeout(() => setBlockedTaskMessage(null), 5000);
            }
        } catch {
            setBlockedTaskMessage('Failed to trigger Prolance get quote.');
            setTimeout(() => setBlockedTaskMessage(null), 4000);
        } finally {
            setGetQuoteBusy(false);
        }
    };

    useEffect(() => {
        if (projectId == null) {
            setProjectLoaded(true);
            return;
        }
        setProjectLoaded(false);
        fetch(`${API}/api/leads/${projectId}`, {
            headers: buildAuthHeaders(sessionId),
        })
            .then(async (res) => {
                const text = await res.text();
                if (!res.ok) throw new Error('Not ok');
                try {
                    return text ? (JSON.parse(text) as LeadshipTypes) : null;
                } catch {
                    throw new Error('Invalid JSON');
                }
            })
            .then((data: LeadshipTypes | null) => { if (data) setProject(data); })
            .catch(() => {
                const fallback = staticProjects.find((p) => p.id === projectId) ?? null;
                setProject(fallback);
            })
            .finally(() => setProjectLoaded(true));
    }, [projectId, sessionId]);

    // When Group Description popup opens, auto-fetch latest profile (designer phone) and lead (client contactNo)
    useEffect(() => {
        const isGroupDesc = popupContext?.milestoneIndex === 0 && popupContext?.taskName === 'Group Description';
        if (!isGroupDesc || projectId == null) return;
        refreshUser();
        fetch(`${API}/api/leads/${projectId}`, {
            headers: buildAuthHeaders(sessionId),
        })
            .then(async (res) => {
                const text = await res.text();
                if (!res.ok || !text) return null;
                try { return JSON.parse(text) as LeadshipTypes; } catch { return null; }
            })
            .then((data: LeadshipTypes | null) => { if (data) setProject(data); })
            .catch(() => {});
    }, [popupContext?.milestoneIndex, popupContext?.taskName, projectId, refreshUser, sessionId]);

    // Load history from server. Only apply response if still for same lead; merge with current state so we never drop recent events.
    const loadHistory = useCallback(() => {
        if (projectId == null) return;
        historyLeadIdRef.current = projectId;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;
        const loadingForId = projectId;
        fetch(`${API}/api/leads/${projectId}/history`, { headers, credentials: 'include' })
            .then(async (res) => {
                const text = await res.text();
                if (!res.ok || !text) return [];
                try { const d = JSON.parse(text); return Array.isArray(d) ? d : []; } catch { return []; }
            })
            .then((data: HistoryEvent[]) => {
                if (historyLeadIdRef.current !== loadingForId) return;
                setHistoryEvents((prev) => {
                    const serverIds = new Set((data ?? []).map((e) => e.id).filter(Boolean));
                    const fromPrev = prev.filter((e) => e.id && !serverIds.has(e.id));
                    const merged = [...(data ?? []), ...fromPrev];
                    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    return merged;
                });
            })
            .catch(() => { /* keep existing state on error instead of clearing */ });
    }, [projectId, sessionId]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // Restore completed tasks from DB so it persists across refresh
    useEffect(() => {
        if (projectId == null || !sessionId) return;
        const headers: Record<string, string> = { Authorization: `Bearer ${sessionId}` };
        fetch(`${API}/api/leads/${projectId}/completions`, { headers })
            .then((res) => res.text().then((t) => { try { return t ? JSON.parse(t) : []; } catch { return []; } }))
            .then((rows: Array<{ milestoneIndex: number; taskName: string }>) => {
                if (!Array.isArray(rows)) return;
                const keys = rows
                    .filter((r) => typeof r?.milestoneIndex === 'number' && typeof r?.taskName === 'string')
                    .map((r) => taskKey(r.milestoneIndex, r.taskName));
                setCompletedTaskKeys(Array.from(new Set(keys)));
            })
            .catch(() => {});
    }, [projectId, sessionId]);

    const loadDqcFileBlob = useCallback((fileToLoad: { id: number; originalName: string }) => {
        if (!projectId || !sessionId) return Promise.resolve();
        const url = `${API}/api/leads/${projectId}/uploads/${fileToLoad.id}/file?path=${encodeURIComponent(fileToLoad.originalName)}`;
        return fetch(url, { headers: { Authorization: `Bearer ${sessionId}` } })
            .then((r) => {
                if (!r.ok) return Promise.reject(new Error(r.status === 404 ? 'File not found.' : 'Could not load file.'));
                return r.blob();
            })
            .then((blob) => {
                if (!blob) return;
                setDqc1SubmissionLoading(false);
                const isPdf = blob.type === 'application/pdf';
                setDqc1SubmissionNotPdf(!isPdf);
                setDqc1PdfFile(new File([blob], fileToLoad.originalName, { type: blob.type }));
                setDqc1PdfPageNumber(1);
                setDqc1CommentPopup(null);
                setDqc1SelectedPin(null);
                if (isPdf) {
                    if (dqc1SubmissionBlobUrlRef.current) URL.revokeObjectURL(dqc1SubmissionBlobUrlRef.current);
                    const blobUrl = URL.createObjectURL(blob);
                    dqc1SubmissionBlobUrlRef.current = blobUrl;
                    setDqc1PdfUrl(blobUrl);
                } else {
                    setDqc1PdfUrl(null);
                }
            });
    }, [projectId, sessionId]);

    // Load the file(s) uploaded in DQC 1 submission (same as in "Files Uploaded") for the Design QC Review panel. Callable so DQC can retry.
    const loadDqcSubmissionFile = useCallback(() => {
        if (!projectId || !sessionId) return;
        setDqc1SubmissionLoadError(null);
        setDqc1SubmissionNotPdf(false);
        setDqc1SubmissionLoading(true);
        fetch(`${API}/api/leads/${projectId}/dqc-submission-files`, {
            headers: { Authorization: `Bearer ${sessionId}` },
        })
            .then((res) => {
                if (!res.ok) {
                    const msg =
                        res.status === 401
                            ? 'Please log in again to load submission files.'
                            : res.status === 403
                              ? 'Only DQC Manager or DQE can access submission files. Check you’re logged in with the correct role.'
                              : res.status === 404
                                ? 'Not found.'
                                : 'Could not load submission files.';
                    setDqc1SubmissionLoadError(msg);
                    setDqc1SubmissionLoading(false);
                    return null;
                }
                return res.json();
            })
            .then((data: { drawing?: { id: number; originalName: string }; quotation?: { id: number; originalName: string }; drawingFiles?: Array<{ id: number; originalName: string }>; quotationFiles?: Array<{ id: number; originalName: string }> } | null) => {
                if (data === null) return;
                const drawingFiles = Array.isArray(data?.drawingFiles) ? data.drawingFiles : [];
                const quotationFiles = Array.isArray(data?.quotationFiles) ? data.quotationFiles : [];
                const allFiles = [...drawingFiles, ...quotationFiles];
                setDqcSubmissionFiles(allFiles);
                const fileToLoad = allFiles[0] ?? data?.drawing ?? data?.quotation ?? null;
                if (!fileToLoad) {
                    setDqc1SubmissionLoadError('No DQC submission files found for this lead.');
                    setDqc1SubmissionLoading(false);
                    return;
                }
                setSelectedDqcSubmissionFileId(fileToLoad.id);
                return loadDqcFileBlob(fileToLoad).catch((err) => {
                    setDqc1SubmissionLoadError(err?.message || 'Could not load the submitted file. Use "Choose PDF" to load a file manually.');
                    setDqc1SubmissionLoading(false);
                });
            })
            .catch(() => {
                setDqc1SubmissionLoadError('Could not load DQC submission files. Check your connection and try again.');
                setDqc1SubmissionLoading(false);
            });
    }, [projectId, sessionId, loadDqcFileBlob]);

    const loadDqc2SubmissionFile = useCallback(() => {
        if (!projectId || !sessionId) return;
        setDqc1SubmissionLoadError(null);
        setDqc1SubmissionNotPdf(false);
        setDqc1SubmissionLoading(true);
        fetch(`${API}/api/leads/${projectId}/dqc2-submission-files`, {
            headers: { Authorization: `Bearer ${sessionId}` },
        })
            .then((res) => {
                if (!res.ok) {
                    const msg =
                        res.status === 401
                            ? 'Please log in again to load submission files.'
                            : res.status === 403
                              ? 'Only DQC Manager or DQE can access submission files.'
                              : res.status === 404
                                ? 'Not found.'
                                : 'Could not load DQC 2 submission files.';
                    setDqc1SubmissionLoadError(msg);
                    setDqc1SubmissionLoading(false);
                    return null;
                }
                return res.json();
            })
            .then((data: { drawing?: { id: number; originalName: string }; quotation?: { id: number; originalName: string }; drawingFiles?: Array<{ id: number; originalName: string }>; quotationFiles?: Array<{ id: number; originalName: string }> } | null) => {
                if (data === null) return;
                const drawingFiles = Array.isArray(data?.drawingFiles) ? data.drawingFiles : [];
                const quotationFiles = Array.isArray(data?.quotationFiles) ? data.quotationFiles : [];
                const allFiles = [...drawingFiles, ...quotationFiles];
                setDqcSubmissionFiles(allFiles);
                const fileToLoad = allFiles[0] ?? data?.drawing ?? data?.quotation ?? null;
                if (!fileToLoad) {
                    setDqc1SubmissionLoadError('No DQC 2 submission files found for this lead.');
                    setDqc1SubmissionLoading(false);
                    return;
                }
                setSelectedDqcSubmissionFileId(fileToLoad.id);
                return loadDqcFileBlob(fileToLoad).catch((err) => {
                    setDqc1SubmissionLoadError(err?.message || 'Could not load the submitted file.');
                    setDqc1SubmissionLoading(false);
                });
            })
            .catch(() => {
                setDqc1SubmissionLoadError('Could not load DQC 2 submission files.');
                setDqc1SubmissionLoading(false);
            });
    }, [projectId, sessionId, loadDqcFileBlob]);

    // When DQC 1 approval popup opens, auto-load DQC 1 submission file
    useEffect(() => {
        if (popupContext?.milestoneIndex !== 1 || popupContext?.taskName !== 'DQC 1 approval' || !projectId || !sessionId) return;
        loadDqcSubmissionFile();
        return () => {
            setDqc1SubmissionLoading(false);
            if (dqc1SubmissionBlobUrlRef.current) {
                URL.revokeObjectURL(dqc1SubmissionBlobUrlRef.current);
                dqc1SubmissionBlobUrlRef.current = null;
            }
        };
    }, [popupContext?.milestoneIndex, popupContext?.taskName, projectId, sessionId, loadDqcSubmissionFile]);

    // When DQC 2 approval popup opens, auto-load DQC 2 submission file for the reviewer panel
    const isDqc2Approval = popupContext?.milestoneIndex === 4 && (popupContext?.taskName === 'DQC 2 approval' || popupContext?.taskName === 'DQC 2 approval ');
    useEffect(() => {
        if (!isDqc2Approval || !projectId || !sessionId) return;
        loadDqc2SubmissionFile();
        return () => {
            setDqc1SubmissionLoading(false);
            if (dqc1SubmissionBlobUrlRef.current) {
                URL.revokeObjectURL(dqc1SubmissionBlobUrlRef.current);
                dqc1SubmissionBlobUrlRef.current = null;
            }
        };
    }, [isDqc2Approval, projectId, sessionId, loadDqc2SubmissionFile]);

    // When DQC user opens lead with ?view=dqc (Quality Check), load DQC 1 or DQC 2 submission file based on stage
    useEffect(() => {
        if (!viewDqc || !isDqcUser || !projectId || !sessionId) return;
        if (dqcStage === 'dqc2') {
            loadDqc2SubmissionFile();
        } else {
            loadDqcSubmissionFile();
        }
        return () => {
            setDqc1SubmissionLoading(false);
            if (dqc1SubmissionBlobUrlRef.current) {
                URL.revokeObjectURL(dqc1SubmissionBlobUrlRef.current);
                dqc1SubmissionBlobUrlRef.current = null;
            }
        };
    }, [viewDqc, isDqcUser, dqcStage, projectId, sessionId, loadDqcSubmissionFile, loadDqc2SubmissionFile]);

    const [image, setImage] = useState<ImageType[]>([]);

    // Fetch involved users (D1/D2 assignees + uploaders) and their profile images for header avatars
    useEffect(() => {
        if (!projectId || !sessionId) return;
        const headers: Record<string, string> = { Authorization: `Bearer ${sessionId}` };
        fetch(`${API}/api/leads/${projectId}/involved-users`, { headers })
            .then((res) => res.json())
            .then((data: { id: number; name: string; profileImage: string | null }[]) => {
                if (Array.isArray(data)) {
                    setImage(data.map((u) => ({
                        id: u.id,
                        img: u.profileImage || '',
                        name: u.name || '',
                    })));
                }
            })
            .catch(() => {});
    }, [projectId, sessionId]);

    useEffect(() => {
        return () => {
            if (dqc1PdfUrl) URL.revokeObjectURL(dqc1PdfUrl);
        };
    }, [dqc1PdfUrl]);

    if (!projectLoaded) {
        return <div className="p-8 flex items-center justify-center min-h-[200px]">Loading...</div>;
    }
    if (!project) {
        return <div className="p-8">Project Not Found</div>;
    }

    const canCancelLead = ['admin', 'territorial_design_manager', 'deputy_general_manager'].includes(
        (authUser?.role || '').toLowerCase(),
    );

    const handleImageAdding = () => {
        // TODO: wire to "add user to project" when backend supports it
        const maxId = image.length > 0 ? Math.max(...image.map((img) => img.id)) : 0;
        const newImage: ImageType = { id: maxId + 1, img: '', name: '' };
        setImage([...image, newImage]);
    };
   
    // Toggle function: If clicking the same card, close it. If new card, open it.
    const toggleMaximize = (cardName: string) => {
        if (activeCard === cardName) {
            setActiveCard(null); // Minimize
        } else {
            setActiveCard(cardName); // Maximize
        }
    };

    /**
     * Helper to determine class names for cards
     * 1. If THIS card is active -> Full Screen
     * 2. If ANOTHER card is active -> Hidden
     * 3. If NO card is active -> Normal grid placement
     */
    const getCardClass = (cardName: string, defaultClasses: string) => {
        if (activeCard === cardName) {
            return "fixed inset-0 z-50 bg-white p-8 m-0 w-full h-full overflow-auto";
        }
        if (activeCard !== null && activeCard !== cardName) {
            return "hidden";
        }
        return defaultClasses;
    };

    const openTaskPopup = (milestoneIndex: number, taskName: string) => {
        if (project && (project.projectStage || '').trim().toLowerCase() === 'cancelled') {
            setBlockedTaskMessage('This project has been cancelled.');
            setTimeout(() => setBlockedTaskMessage(null), 3000);
            return;
        }
        // Only allow opening tasks for the current or past milestones; next milestones unlock after current is completed
        if (milestoneIndex > currentMilestoneIndex) {
            setBlockedTaskMessage('Complete the current milestone first.');
            setTimeout(() => setBlockedTaskMessage(null), 3000);
            return;
        }

        const milestone = MileStonesArray.MilestonesName[milestoneIndex];
        if (!milestone) return;

        // If this task has a checklist, force the checklist to be completed before showing the popup.
        const tTrim = taskName.trim();
        if (milestoneIndex === 4 && tTrim === 'Assign project manager') {
            const dqc2Approved = completedTaskKeys.includes(taskKey(4, 'DQC 2 approval '));
            if (!dqc2Approved) {
                setBlockedTaskMessage('Complete DQC 2 approval before assigning a project manager.');
                setTimeout(() => setBlockedTaskMessage(null), 4000);
                return;
            }
            const assignerRole = (authUser?.role || '').toLowerCase();
            const canAssignPm = ['admin', 'territorial_design_manager', 'deputy_general_manager', 'senior_project_manager'].includes(
                assignerRole,
            );
            if (!canAssignPm) {
                setBlockedTaskMessage(
                    'Only Admin, Territorial Design Manager, Deputy General Manager, or Senior Project Manager can assign a project manager.',
                );
                setTimeout(() => setBlockedTaskMessage(null), 5000);
                return;
            }
        }
        if (milestoneIndex === 4 && tTrim === 'Project manager approval') {
            const assignDone = completedTaskKeys.includes(taskKey(4, 'Assign project manager'));
            if (!assignDone) {
                setBlockedTaskMessage('Assign a project manager first.');
                setTimeout(() => setBlockedTaskMessage(null), 4000);
                return;
            }
            const role = (authUser?.role || '').toLowerCase();
            const pmId = project?.assigned_project_manager_id;
            if (role !== 'project_manager' || !pmId || !authUser?.id || pmId !== authUser.id) {
                setBlockedTaskMessage('Only the assigned project manager can open this approval step.');
                setTimeout(() => setBlockedTaskMessage(null), 4000);
                return;
            }
        }

        const checklistKey = getChecklistKeyForTask(milestoneIndex, taskName);
        if (checklistKey) {
            const key = taskKey(milestoneIndex, taskName);
            const hasCompletedChecklist = completedChecklistKeys.includes(key);
            if (!hasCompletedChecklist) {
                setBlockedTaskMessage('Please complete the checklist for this task before opening the popup.');
                setTimeout(() => setBlockedTaskMessage(null), 3000);
                // Automatically open the checklist modal to guide the user.
                setChecklistContext({
                    milestoneIndex,
                    milestoneName: milestone.name,
                    taskName,
                });
                return;
            }
        }

        setPopupContext({ milestoneIndex, milestoneName: milestone.name, taskName });
        if (taskName === 'DQC 1 approval' || taskName === 'DQC 2 approval' || taskName === 'DQC 2 approval ')
            setDqc1Verdict(null);
    };


    const closePopup = () => {
        setPopupContext(null);
        setDqc1Verdict(null);
        setDqc1Remarks([
            { id: 1, priority: 'high', text: 'Dimension Issue: Missing cabinet clearance dimensions on Wall B. The spacing between the refrigerator island and main counter seems insufficient for ADA compliance.', pinNumber: 1, xPct: 28, yPct: 35, page: 1 },
            { id: 2, priority: 'medium', text: 'Material Issue: Check backsplash material compatibility with induction heat specs. Quartz might require additional heat shielding behind the range area.', pinNumber: 2, xPct: 55, yPct: 52, page: 1 },
        ]);
        setNewRemarkText('');
        setNewRemarkPriority('medium');
        setDqc1AnnotateMode(false);
        setDqc1CommentPopup(null);
        setDqc1SelectedPin(null);
        setDqc1PdfNumPages(0);
        setDqc1PdfPageNumber(1);
        setDqc1PdfFile(null);
        setDqcSubmissionFiles([]);
        setSelectedDqcSubmissionFileId(null);
        setDqc1PdfMaximized(false);
        if (dqc1PdfUrl) URL.revokeObjectURL(dqc1PdfUrl);
        setDqc1PdfUrl(null);
        setDesignUploadFiles([]);
        setMomMinutes('');
        setMomReferenceFiles([]);
    };

    const addDqc1Remark = () => {
        if (!newRemarkText.trim()) return;
        const position = dqc1CommentPopup;
        if (!position) return;
        const nextPin = Math.max(0, ...dqc1Remarks.map((r) => r.pinNumber)) + 1;
        setDqc1Remarks((prev) => [
            ...prev,
            {
                id: Date.now(),
                priority: newRemarkPriority,
                text: newRemarkText.trim(),
                pinNumber: nextPin,
                xPct: position.xPct,
                yPct: position.yPct,
                page: position.page,
                uploadId: selectedDqcSubmissionFileId ?? undefined,
                uploadName: dqc1PdfFile?.name ?? undefined,
                docX: position.docX,
                docY: position.docY,
            },
        ]);
        setNewRemarkText('');
        setDqc1CommentPopup(null);
        setDqc1SelectedPin(nextPin);
    };
    const removeDqc1Remark = (id: number) => setDqc1Remarks((prev) => prev.filter((r) => r.id !== id));

    const focusRemarkInPdf = (r: QCRemark) => {
        setDqc1SelectedPin(r.pinNumber);
        setDqc1PdfPageNumber(r.page);
        setDqc1HighlightedPin(r.pinNumber);
        setTimeout(() => setDqc1HighlightedPin(null), 1800);
        requestAnimationFrame(() => {
            dqc1PdfViewportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                const viewport = dqc1PdfViewportRef.current;
                const scrollEl = dqc1PdfScrollRef.current;
                if (!viewport || !scrollEl) return;
                const pinCenterX = viewport.offsetLeft + (r.xPct / 100) * viewport.offsetWidth;
                const pinCenterY = viewport.offsetTop + (r.yPct / 100) * viewport.offsetHeight;
                scrollEl.scrollTo({
                    left: Math.max(0, pinCenterX - scrollEl.clientWidth / 2),
                    top: Math.max(0, pinCenterY - scrollEl.clientHeight / 2),
                    behavior: 'smooth',
                });
            }, 300);
        });
    };

    const onDqc1PdfSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        if (!file) return;
        setDqc1SubmissionLoadError(null);
        setDqc1SubmissionNotPdf(false);
        setDqc1PdfFile(file);
        setDqc1AnnotateMode(false);
        setDqc1CommentPopup(null);
        setDqc1SelectedPin(null);
        setSelectedDqcSubmissionFileId(null);
        setDqc1PdfPageNumber(1);
        if (dqc1PdfUrl) URL.revokeObjectURL(dqc1PdfUrl);
        setDqc1PdfUrl(URL.createObjectURL(file));
        e.target.value = '';
    };

    const addHistoryEvent = (event: Omit<HistoryEvent, 'id' | 'timestamp'>) => {
        const full: HistoryEvent = {
            ...event,
            id: `ev-${Math.random().toString(36).slice(2, 11)}`,
            timestamp: new Date().toISOString(),
        };
        setHistoryEvents((prev) => [full, ...prev]);
        // Persist to server only; do not refetch here so we never overwrite with a stale response and lose entries
        if (projectId != null) {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            fetch(`${API}/api/leads/${projectId}/history`, {
                method: 'POST',
                headers: buildAuthHeaders(sessionId, headers),
                credentials: 'include',
                body: JSON.stringify(full),
            }).catch((err) => console.error('Failed to persist history event:', err));
        }
    };

    // Record a task completion in history and mark the task complete (keeps history in sync with milestones).
    const recordTaskComplete = (
        milestoneIndex: number,
        taskName: string,
        options?: {
            details?: HistoryEvent['details'];
            description?: string;
            meta?: Record<string, unknown>;
        }
    ) => {
        const requiresChecklist = getChecklistKeyForTask(milestoneIndex, taskName) !== null;
        const key = taskKey(milestoneIndex, taskName);
        if (requiresChecklist && !completedChecklistKeys.includes(key)) {
            setBlockedTaskMessage('Please complete the checklist for this task before marking it as done.');
            setTimeout(() => setBlockedTaskMessage(null), 3000);
            return;
        }
        const milestone = MileStonesArray.MilestonesName[milestoneIndex];
        const milestoneName = milestone?.name ?? `Milestone ${milestoneIndex + 1}`;
        addHistoryEvent({
            type: 'completed',
            taskName,
            milestoneName,
            description: options?.description ?? `${taskName} completed.`,
            user: { name: authUser?.name ?? 'Current User', avatar: authUser?.profileImage },
            details: options?.details,
        });
        // persist completion for this lead so refresh keeps it completed
        if (projectId != null) {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (sessionId) headers.Authorization = `Bearer ${sessionId}`;
            fetch(`${API}/api/leads/${projectId}/complete-task`, {
                method: 'POST',
                headers: buildAuthHeaders(sessionId, { 'Content-Type': 'application/json' }),
                body: JSON.stringify({ milestoneIndex, taskName, meta: options?.meta }),
            })
                .then(async (res) => {
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        const msg = (data as { message?: string })?.message;
                        if (msg) {
                            setBlockedTaskMessage(msg);
                            setTimeout(() => setBlockedTaskMessage(null), 5000);
                        }
                    }
                })
                .catch(() => {});
        }
        markTaskComplete(milestoneIndex, taskName);
    };

    const submitDqc1Review = () => {
        // Use DQC1 or DQC2 context: from popup (designer view) or from URL stage (DQC-only view)
        const isDqc2 =
            (popupContext?.milestoneIndex === 4 &&
                (popupContext.taskName === 'DQC 2 approval' || popupContext.taskName === 'DQC 2 approval ')) ||
            (viewDqc && isDqcUser && dqcStage === 'dqc2');
        const milestoneIndex = isDqc2 ? 4 : 1;
        const taskName =
            (isDqc2 && popupContext?.taskName) ? popupContext.taskName : 'DQC 1 approval';
        const milestoneName = isDqc2 ? 'DQC2' : 'DQC1';
        if (dqc1Verdict) {
            addHistoryEvent({
                type: 'completed',
                taskName,
                milestoneName,
                description: dqc1Verdict === 'approved'
                    ? `${taskName} completed. Design QC review submitted.`
                    : `DQC review submitted: ${dqc1Verdict === 'rejected' ? 'Rejected' : 'Approved with changes'}. Designer must address comments.`,
                user: { name: authUser?.name ?? 'Current User', avatar: authUser?.profileImage },
                details: {
                    kind: 'dqc_review',
                    verdict: dqc1Verdict,
                    pdfName: dqc1PdfFile?.name,
                    remarks: dqc1Remarks.map((r) => ({ priority: r.priority, text: r.text })),
                },
            });
            // Move to next milestone:
            // - DQC1: only when fully approved
            // - DQC2: for any verdict except "rejected"
            const movesToNextMilestone = isDqc2 ? dqc1Verdict !== 'rejected' : dqc1Verdict === 'approved';
            if (movesToNextMilestone && projectId != null) {
                if (isDqc2) {
                    // For DQC2 approval: only complete the approval task (send DQC2 approval email).
                    // Material meeting + submission tasks are completed earlier when designer does them.
                    const dqc2ApprovalTasks = ['DQC 2 approval '];
                    dqc2ApprovalTasks.forEach((t: string) => {
                        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                        if (sessionId) headers.Authorization = `Bearer ${sessionId}`;
                        fetch(`${API}/api/leads/${projectId}/complete-task`, {
                            method: 'POST',
                            headers: buildAuthHeaders(sessionId, { 'Content-Type': 'application/json' }),
                            body: JSON.stringify({ milestoneIndex: 4, taskName: t }),
                        }).catch(() => {});
                        markTaskComplete(4, t);
                    });
                } else {
                    // DQC1 approval should move lead to next stage reliably.
                    // Mark all DQC1 tasks complete when verdict is approved.
                    const dqc1Tasks = [
                        'First cut design + quotation discussion meeting request',
                        'meeting completed',
                        'DQC 1 submission - dwg + quotation',
                        'DQC 1 approval',
                    ];
                    dqc1Tasks.forEach((t: string) => {
                        fetch(`${API}/api/leads/${projectId}/complete-task`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ milestoneIndex: 1, taskName: t }),
                        }).catch(() => {});
                        markTaskComplete(1, t);
                    });
                    // DQC1: mark only the approval task; other tasks should already be completed manually.
                    fetch(`${API}/api/leads/${projectId}/complete-task`, {
                        method: 'POST',
                        headers: buildAuthHeaders(sessionId, { 'Content-Type': 'application/json' }),
                        body: JSON.stringify({
                            milestoneIndex,
                            taskName,
                        }),
                    }).catch(() => {});
                    markTaskComplete(milestoneIndex, taskName);
                }
            }
            if (projectId != null) {
                fetch(`${API}/api/leads/${projectId}/dqc-review`, {
                    method: 'POST',
                    headers: buildAuthHeaders(sessionId, { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        verdict: dqc1Verdict,
                        remarks: dqc1Remarks.map((r) => ({
                            priority: r.priority,
                            text: r.text,
                            page: r.page,
                            xPct: r.xPct,
                            yPct: r.yPct,
                            pinNumber: r.pinNumber,
                            uploadId: r.uploadId,
                            uploadName: r.uploadName,
                        })),
                    }),
                }).catch(() => {});
            }
        }
        if (viewDqc && isDqcUser) {
            router.push('/');
            return;
        }
        closePopup();
    };

    // Design file upload: open file picker with accept type
    const openDesignFileUpload = (accept: string) => {
        designFileInputRef.current?.setAttribute('accept', accept);
        designFileInputRef.current?.click();
    };
    const onDesignFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        setDesignUploadFiles((prev) => [...prev, ...files]);
        e.target.value = '';
    };
    const onDesignDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
        setDesignUploadFiles((prev) => [...prev, ...files]);
    };
    const onDesignDragOver = (e: React.DragEvent) => e.preventDefault();
    const removeDesignFile = (index: number) => {
        setDesignUploadFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // MOM reference files upload
    const openMomFileUpload = () => momFileInputRef.current?.click();
    const onMomFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        setMomReferenceFiles((prev) => [...prev, ...files].slice(0, 2)); // max 2 slots
        e.target.value = '';
    };
    const onMomDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files || []);
        setMomReferenceFiles((prev) => [...prev, ...files].slice(0, 2));
    };
    const removeMomFile = (index: number) => setMomReferenceFiles((prev) => prev.filter((_, i) => i !== index));

    const scrollMilestoneCards = (direction: 'left' | 'right') => {
        const el = milestoneCardsScrollRef.current;
        if (!el) return;
        const step = el.clientWidth * 0.8;
        el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
    };

    const getReviewerInitials = (name: string | undefined) => {
        if (!name || !name.trim()) return "—";
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };
    const getReviewerRoleLabel = (role: string | undefined) => {
        const r = (role || "").toLowerCase();
        if (r === "dqe") return "Lead QA Engineer";
        if (r === "dqc_manager") return "DQC Manager";
        return role || "Reviewer";
    };

    const getTaskStatus = (milestoneIndex: number, taskIndex: number, taskList: string[]) => {
        const taskName = taskList[taskIndex];
        const key = taskKey(milestoneIndex, taskName);
        const isCompleted = completedTaskKeys.includes(key);
        const isCurrentMilestone = milestoneIndex === currentMilestoneIndex;
        const isPastMilestone = milestoneIndex < currentMilestoneIndex;

        if (isCompleted) return { icon: 'completed' as const, subtitle: 'Completed', tags: ['ON-TIME'] as const };
        if (isPastMilestone) return { icon: 'completed' as const, subtitle: 'Completed', tags: ['ON-TIME'] as const };
        if (!isCurrentMilestone) return { icon: 'pending' as const, subtitle: 'Not started', tags: ['PENDING'] as const };

        const firstIncompleteIndex = taskList.findIndex((t) => !completedTaskKeys.includes(taskKey(milestoneIndex, t)));
        const isCurrentTask = firstIncompleteIndex === taskIndex;
        if (isCurrentTask) return { icon: 'current' as const, subtitle: 'In progress', tags: ['CURRENT', 'ACTION'] as const };
        return { icon: 'pending' as const, subtitle: 'Not started', tags: ['PENDING'] as const };
    };

    // DQC Manager / DQE: only show DQC1 approval UI (no Prolance, HOLD, RESUME, History, ChatBox, full tracker)
    if (viewDqc && isDqcUser) {
        if (authLoading) {
            return (
                <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8">
                    <p className="text-gray-600">Loading…</p>
                    <p className="text-sm text-gray-500 mt-2">Preparing DQC submission file…</p>
                </div>
            );
        }
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col">
                <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
                    <div className="flex flex-wrap items-baseline gap-6">
                        <span className="text-gray-600 font-medium">Lead ID:</span>
                        <span className="font-bold text-gray-900">{project.id}</span>
                        <span className="text-gray-600 font-medium">Name:</span>
                        <span className="font-bold text-gray-900">{project.projectName}</span>
                        <span className="text-gray-600 font-medium">Stage:</span>
                        <span className="font-bold text-gray-900">{project.projectStage || 'Active'}</span>
                        {dqcStage && (
                            <span className="px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 text-sm font-semibold">
                                {dqcStage === 'dqc2' ? 'DQC 2 Approval' : 'DQC 1 Approval'}
                            </span>
                        )}
                    </div>
                    <a
                        href="/"
                        className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50"
                    >
                        Back to DQC queue
                    </a>
                </div>
                <div className="flex-1 min-h-0 flex flex-col bg-white m-4 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <PopupDqc1Approval
                        onClose={() => router.push('/')}
                        reviewTitle={dqcStage === 'dqc2' ? 'DQC 2 Approval' : 'DQC 1 Approval'}
                        projectTitle={project.projectName}
                        projectRef={project.pid || `REF-${project.id}`}
                        revision={project.revision ?? undefined}
                        designerName={project.designerName ?? undefined}
                        reviewerName={authUser?.name ?? undefined}
                        reviewerInitials={getReviewerInitials(authUser?.name)}
                        reviewerRoleLabel={getReviewerRoleLabel(authUser?.role)}
                        reviewStatus="PENDING REVIEW"
                        dqc1Verdict={dqc1Verdict}
                        setDqc1Verdict={setDqc1Verdict}
                        dqc1Remarks={dqc1Remarks}
                        removeDqc1Remark={removeDqc1Remark}
                        addDqc1Remark={addDqc1Remark}
                        focusRemarkInPdf={focusRemarkInPdf}
                        newRemarkText={newRemarkText}
                        setNewRemarkText={setNewRemarkText}
                        newRemarkPriority={newRemarkPriority}
                        setNewRemarkPriority={setNewRemarkPriority}
                        dqc1PdfFile={dqc1PdfFile}
                        dqc1PdfUrl={dqc1PdfUrl}
                        dqc1PdfInputRef={dqc1PdfInputRef}
                        onDqc1PdfSelected={onDqc1PdfSelected}
                        dqc1PdfMaximized={dqc1PdfMaximized}
                        setDqc1PdfMaximized={setDqc1PdfMaximized}
                        dqc1PdfNumPages={dqc1PdfNumPages}
                        dqc1PdfPageNumber={dqc1PdfPageNumber}
                        setDqc1PdfPageNumber={setDqc1PdfPageNumber}
                        dqc1AnnotateMode={dqc1AnnotateMode}
                        setDqc1AnnotateMode={setDqc1AnnotateMode}
                        dqc1CommentPopup={dqc1CommentPopup}
                        setDqc1CommentPopup={setDqc1CommentPopup}
                        dqc1PdfViewportRef={dqc1PdfViewportRef}
                        dqc1PdfScrollRef={dqc1PdfScrollRef}
                        dqc1SelectedPin={dqc1SelectedPin}
                        setDqc1SelectedPin={setDqc1SelectedPin}
                        dqc1HighlightedPin={dqc1HighlightedPin}
                        setDqc1PdfNumPages={setDqc1PdfNumPages}
                        submitDqc1Review={submitDqc1Review}
                        dqc1SubmissionLoadError={dqc1SubmissionLoadError}
                        dqc1SubmissionNotPdf={dqc1SubmissionNotPdf}
                        dqc1SubmissionLoading={dqc1SubmissionLoading}
                        onLoadDqcSubmission={dqcStage === 'dqc2' ? loadDqc2SubmissionFile : loadDqcSubmissionFile}
                        dqcSubmissionFiles={dqcSubmissionFiles}
                        selectedDqcSubmissionFileId={selectedDqcSubmissionFileId}
                        onSelectDqcSubmissionFile={(id) => {
                            const file = dqcSubmissionFiles.find((f) => f.id === id);
                            if (!file) return;
                            setSelectedDqcSubmissionFileId(id);
                            setDqc1SubmissionLoading(true);
                            loadDqcFileBlob(file).catch(() => {
                                setDqc1SubmissionLoadError('Could not load selected file.');
                                setDqc1SubmissionLoading(false);
                            });
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className='bg-slate-900 xl:min-h-[900px] 2xl:min-h-[1400px]'>
            {!activeCard && (
                <LeadDetailHeader
                    project={project}
                    image={image}
                    onAddImage={handleImageAdding}
                    currentMilestoneIndex={currentMilestoneIndex}
                    onHoldClick={() => setShowHoldModal(true)}
                    onResumeClick={async () => {
                        if (!projectId) return;
                        try {
                            await fetch(`${API}/api/leads/${projectId}/resume`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                            });
                            setProject((prev) => (prev ? { ...prev, isOnHold: false, resumeAt: null } : prev));
                        } catch {
                            // ignore
                        }
                    }}
                    showCancelButton={canCancelLead && !isMmtUser}
                    onCancelClick={() => setShowCancelModal(true)}
                    hideNavTabs={isMmtUser}
                    hideStepper={isMmtUser}
                    hideProlanceHoldResume={isMmtUser}
                    onProlanceClick={triggerProlanceCreate}
                    prolanceBusy={prolanceBusy}
                    onGetQuoteClick={() => {
                        if (!manualQuoteProjectId && prolanceProjectId) {
                            setManualQuoteProjectId(String(prolanceProjectId));
                        }
                        setGetQuoteLastStatus(null);
                        setGetQuoteLastBody(null);
                        setShowGetQuoteModal(true);
                    }}
                    getQuoteBusy={getQuoteBusy}
                    canGetQuote
                />
            )}

            {project && !activeCard && (
                <ClientEmailsSection
                    leadId={projectId}
                    project={project}
                    sessionId={sessionId}
                    readOnly={(authUser?.role || '').toLowerCase() === 'designer'}
                    onUpdate={(patch) => setProject((prev) => (prev ? { ...prev, ...patch } : prev))}
                />
            )}

            {blockedTaskMessage && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg shadow-lg animate-pulse">
                    {blockedTaskMessage}
                </div>
            )}

            {showGetQuoteModal && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Get Quote</h2>
                        <p className="text-sm text-gray-600">Enter existing Prolance Project ID to trigger quote API.</p>
                        <input
                            value={manualQuoteProjectId}
                            onChange={(e) => setManualQuoteProjectId(e.target.value)}
                            placeholder="Project ID"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowGetQuoteModal(false)}
                                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                                disabled={getQuoteBusy}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={getQuoteBusy || !manualQuoteProjectId.trim()}
                                onClick={async () => {
                                    const parsed = Number(manualQuoteProjectId.trim());
                                    if (!Number.isFinite(parsed) || parsed <= 0) {
                                        setBlockedTaskMessage('Please enter a valid project ID.');
                                        setTimeout(() => setBlockedTaskMessage(null), 3000);
                                        return;
                                    }
                                    await triggerProlanceGetQuote(parsed);
                                }}
                                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                            >
                                {getQuoteBusy ? 'Triggering...' : 'Get Quote'}
                            </button>
                        </div>
                        {(getQuoteLastStatus !== null || Boolean(getQuoteLastBody)) && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                <p className="text-xs font-semibold text-gray-600">
                                    Last Get Quote response{getQuoteLastStatus !== null ? ` (HTTP ${getQuoteLastStatus})` : ''}
                                </p>
                                <pre className="mt-2 max-h-48 overflow-auto text-[11px] leading-relaxed text-gray-800">
                                    {prettyResponse(getQuoteLastBody) || '—'}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showQuotePreviewModal && (
                <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-6xl max-h-[94vh] overflow-y-auto rounded-2xl bg-[#f3f3f3] shadow-2xl">
                        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#303135] px-6 py-4 text-white">
                            <div>
                                <h2 className="text-lg font-bold tracking-wide">HUBINTERIOR</h2>
                                <p className="text-[11px] text-gray-200">Quotation View</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowQuotePreviewModal(false)}
                                className="rounded-md bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
                            >
                                Close
                            </button>
                        </div>

                        {(() => {
                            const payloadObj = parseLeadPayload((project as unknown as Record<string, unknown>)?.payload);
                            const formData =
                                payloadObj?.formData && typeof payloadObj.formData === 'object'
                                    ? (payloadObj.formData as Record<string, unknown>)
                                    : null;
                            const fetchedData =
                                payloadObj?.fetchedData && typeof payloadObj.fetchedData === 'object'
                                    ? (payloadObj.fetchedData as Record<string, unknown>)
                                    : null;
                            const leadFallback = {
                                customerName:
                                    extractString(project?.projectName) ||
                                    extractString((project as unknown as Record<string, unknown>)?.customerName) ||
                                    extractString(formData?.customer_name) ||
                                    extractString(formData?.sales_lead_name),
                                refId:
                                    extractString((project as unknown as Record<string, unknown>)?.pid) ||
                                    extractString(formData?.reference_id) ||
                                    extractString(payloadObj?.pid),
                                city:
                                    extractString((project as unknown as Record<string, unknown>)?.city) ||
                                    extractString(formData?.city) ||
                                    extractString(fetchedData?.city),
                                bhkType:
                                    extractString((project as unknown as Record<string, unknown>)?.bhkType) ||
                                    extractString(formData?.bhk_type) ||
                                    extractString(formData?.bhkType),
                                projectType:
                                    extractString((project as unknown as Record<string, unknown>)?.projectType) ||
                                    extractString(formData?.project_type) ||
                                    extractString(formData?.projectType),
                                partnerId: prolancePartnerId != null ? String(prolancePartnerId) : null,
                            };
                            const view = normalizeQuoteView(latestQuoteResponse, leadFallback);
                            const displayedPartnerId =
                                leadFallback.partnerId || view.quoteMeta.partnerId || '-';
                            const displayedQuoteNumber =
                                view.quoteNum !== '-'
                                    ? view.quoteNum
                                    : prolanceQuoteId != null
                                        ? String(prolanceQuoteId)
                                        : '-';
                            const shareQuoteIdRaw =
                                extractNumber(view.quotationId) ??
                                extractNumber(displayedQuoteNumber) ??
                                prolanceQuoteId;
                            const shareQuoteId = shareQuoteIdRaw != null ? String(Math.trunc(Number(shareQuoteIdRaw))) : '';
                            const shareQuoteLink =
                                shareQuoteId && typeof window !== 'undefined'
                                    ? `${window.location.origin}/quote/${encodeURIComponent(shareQuoteId)}`
                                    : '';
                            const hasFinancialTotals =
                                extractNumber(view.totals.interiorProjectAmount) != null ||
                                extractNumber(view.totals.designAndManagementFees) != null ||
                                extractNumber(view.totals.discount) != null ||
                                extractNumber(view.totals.totalPayableAmount) != null;
                            return (
                                <div className="mx-auto max-w-5xl space-y-5 px-6 py-6">
                                    <div className="rounded-2xl bg-white p-6 shadow-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-xs font-semibold tracking-wide text-gray-500">QUOTATION ID : {view.quotationId}</p>
                                            {shareQuoteLink ? (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await navigator.clipboard.writeText(shareQuoteLink);
                                                            setQuoteLinkCopied(true);
                                                            setTimeout(() => setQuoteLinkCopied(false), 1800);
                                                        } catch {
                                                            setBlockedTaskMessage('Could not copy quote link.');
                                                            setTimeout(() => setBlockedTaskMessage(null), 2500);
                                                        }
                                                    }}
                                                    className="rounded-md border border-indigo-300 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                                                >
                                                    {quoteLinkCopied ? 'Link Copied' : 'Copy Share Link'}
                                                </button>
                                            ) : null}
                                        </div>
                                        <h3 className="mt-2 text-3xl font-bold text-gray-800">
                                            Hey {view.customerName !== '-' ? view.customerName : 'Customer'}, your quotation is ready!
                                        </h3>
                                    </div>

                                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                        {[
                                            ['Customer Name', view.customerName],
                                            ['Ref ID', view.refId],
                                            ['City', view.city],
                                            ['BHK Type', view.bhkType],
                                            ['Project Type', view.projectType],
                                            ['Project ID', view.projectId],
                                            ['Quote Number', displayedQuoteNumber],
                                        ].map(([label, value]) => (
                                            <div key={label} className="rounded-lg bg-gray-50 p-3">
                                                <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                                                <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
                                            </div>
                                        ))}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                                        <p className="text-3xl font-bold text-gray-800">Summary Detail</p>
                                        <div className="mt-4 grid grid-cols-2 rounded-xl border border-gray-200 p-1">
                                            <button
                                                type="button"
                                                onClick={() => setQuoteSummaryTab('overall')}
                                                className={`rounded-lg py-2 text-sm font-semibold ${quoteSummaryTab === 'overall' ? 'bg-rose-500 text-white' : 'text-gray-700'}`}
                                            >
                                                Overall Summary
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setQuoteSummaryTab('roomwise')}
                                                className={`rounded-lg py-2 text-sm font-semibold ${quoteSummaryTab === 'roomwise' ? 'bg-rose-500 text-white' : 'text-gray-700'}`}
                                            >
                                                Room Wise Summary
                                            </button>
                                        </div>

                                        {quoteSummaryTab === 'overall' ? (
                                            <>
                                                <div className="mt-5 rounded-xl bg-[#efeff2] py-10 text-center">
                                                    <p className="text-lg font-semibold text-gray-700">
                                                        Total <span className="text-2xl text-gray-900">{formatCurrency(view.totals.totalPayableAmount)}</span>
                                                    </p>
                                                </div>

                                                <div className="mt-4 grid grid-cols-12 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                                    <div className="col-span-8">Name</div>
                                                    <div className="col-span-4 text-right">Amount</div>
                                                </div>

                                                {view.lineItems.length ? (
                                                    view.lineItems.map((item, idx) => (
                                                        <div key={`${item.name}-${idx}`} className="grid grid-cols-12 items-center border-t border-gray-100 py-4 text-sm">
                                                            <div className="col-span-8 flex items-center gap-3">
                                                                <span className="h-6 w-2 rounded-full bg-violet-400" />
                                                                <span className="font-semibold text-gray-800">{item.name}</span>
                                                            </div>
                                                            <div className="col-span-4 text-right">
                                                                {item.amount != null &&
                                                                    item.discountedAmount != null &&
                                                                    item.amount > item.discountedAmount && (
                                                                        <span className="mr-2 text-xs text-rose-400 line-through">
                                                                            {formatCurrency(item.amount)}
                                                                        </span>
                                                                    )}
                                                                <span className="text-lg font-semibold text-gray-900">
                                                                    {formatCurrency(item.discountedAmount ?? item.amount)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-5 text-sm text-gray-500">
                                                        Quote details are being prepared. Please verify totals below.
                                                    </div>
                                                )}

                                                <div className="mt-5 space-y-3 rounded-xl border border-gray-200 p-4">
                                                    {hasFinancialTotals ? (
                                                        <>
                                                            <div className="flex items-start justify-between">
                                                                <div>
                                                                    <p className="text-xl font-semibold text-gray-900">Interior Project Amount</p>
                                                                    <p className="text-xs text-gray-500">*Design & Management Fees are not included</p>
                                                                </div>
                                                                <p className="text-lg font-semibold text-gray-900">{formatCurrency(view.totals.interiorProjectAmount)}</p>
                                                            </div>
                                                            <div className="flex justify-between border-t border-gray-100 pt-3">
                                                                <span className="text-sm text-gray-600">Design and Management Fees</span>
                                                                <span className="font-semibold text-gray-900">{formatCurrency(view.totals.designAndManagementFees)}</span>
                                                            </div>
                                                            <div className="flex justify-between border-t border-gray-100 pt-3">
                                                                <span className="text-sm text-gray-600">Discount</span>
                                                                <span className="font-semibold text-gray-900">{formatCurrency(view.totals.discount)}</span>
                                                            </div>
                                                            <div className="flex justify-between border-t border-gray-200 pt-3">
                                                                <div>
                                                                    <p className="text-xl font-bold text-gray-900">Total Payable Amount</p>
                                                                    <p className="text-xs text-gray-500">Inclusive of all taxes & discount</p>
                                                                </div>
                                                                <span className="text-2xl font-bold text-gray-900">{formatCurrency(view.totals.totalPayableAmount)}</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                                                            <p className="text-sm font-semibold text-amber-900">Pricing details not available in this API response</p>
                                                            <p className="mt-1 text-xs text-amber-800">
                                                                This response currently returns quote metadata (like quote ID/project ID). Item-level price breakup may require a follow-up quote-details endpoint.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-5 rounded-xl border border-gray-200 p-4">
                                                    <p className="mb-3 text-sm font-semibold text-gray-800">Quote Overview</p>
                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                        {[
                                                            ['Partner ID', displayedPartnerId],
                                                            ['Remarks', view.quoteMeta.remarks],
                                                            ['Created On', view.quoteMeta.createdOn],
                                                            ['Total Price', formatCurrency(view.quoteMeta.totalPrice)],
                                                            ['Final Total Price', formatCurrency(view.quoteMeta.finalTotalPrice)],
                                                            ['Discount', formatCurrency(view.quoteMeta.computedDiscount ?? view.quoteMeta.discount)],
                                                            ['Wood Work Factor', renderPrimitive(view.quoteMeta.woodWorkFactor)],
                                                            ['Accessories Factor', renderPrimitive(view.quoteMeta.accessoriesFactor)],
                                                            ['Hardware Factor', renderPrimitive(view.quoteMeta.hardwareFactor)],
                                                            ['Appliances Factor', renderPrimitive(view.quoteMeta.appliancesFactor)],
                                                            ['Services Factor', renderPrimitive(view.quoteMeta.servicesFactor)],
                                                            ['Worktop Factor', renderPrimitive(view.quoteMeta.worktopFactor)],
                                                        ].map(([label, value]) => (
                                                            <div key={label} className="rounded-lg bg-gray-50 p-3">
                                                                <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                                                                <p className="mt-1 text-sm font-semibold text-gray-900 break-words">{value}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="mt-5 space-y-4">
                                                {view.quoteOptionsData.length ? (
                                                    view.quoteOptionsData.map((opt, idx) => {
                                                        const oldP = extractNumber(opt.totalPriceOld);
                                                        const curP = extractNumber(opt.totalPrice);
                                                        const saving = oldP != null && curP != null ? oldP - curP : null;
                                                        return (
                                                            <div key={`${opt.qoid ?? idx}-${opt.optionID ?? idx}`} className="rounded-xl border border-gray-200 p-4">
                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                    <div>
                                                                        <p className="text-lg font-semibold text-gray-900">{opt.roomName}</p>
                                                                        <p className="text-sm text-gray-600">{opt.optionName}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-xs text-gray-500">Room Total</p>
                                                                        <p className="text-xl font-bold text-gray-900">{formatCurrency(curP)}</p>
                                                                        {oldP != null && (
                                                                            <p className="text-xs text-rose-400 line-through">{formatCurrency(oldP)}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                                                                    {[
                                                                        ['Units', opt.unitsPrice],
                                                                        ['Lofts', opt.loftsPrice],
                                                                        ['Services', opt.servicesPrice],
                                                                        ['Appliances', opt.appliancesPrice],
                                                                        ['Skirtings', opt.skirtingsPrice],
                                                                        ['Worktops', opt.worktopsPrice],
                                                                        ['Additional HW', opt.additionalHWPrice],
                                                                        ['Savings', saving],
                                                                    ].map(([label, value]) => (
                                                                        <div key={`${opt.optionID}-${label}`} className="rounded-lg bg-gray-50 p-2">
                                                                            <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                                                                            <p className={`mt-1 text-sm font-semibold ${label === 'Savings' ? 'text-emerald-700' : 'text-gray-900'}`}>
                                                                                {formatCurrency(value)}
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="mt-4">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setExpandedQuoteRooms((prev) => ({
                                                                                ...prev,
                                                                                [`${opt.qoid ?? idx}-${opt.optionID ?? idx}`]:
                                                                                    !prev[`${opt.qoid ?? idx}-${opt.optionID ?? idx}`],
                                                                            }))
                                                                        }
                                                                        className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                                                                    >
                                                                        {expandedQuoteRooms[`${opt.qoid ?? idx}-${opt.optionID ?? idx}`] ? 'Read less' : 'Read more'}
                                                                    </button>
                                                                </div>
                                                                {expandedQuoteRooms[`${opt.qoid ?? idx}-${opt.optionID ?? idx}`] && (
                                                                    <div className="mt-3 space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                                                                        {opt.roomRev ? (
                                                                            <p className="text-xs text-gray-600">
                                                                                <span className="font-semibold text-gray-800">Room Revision:</span> {opt.roomRev}
                                                                            </p>
                                                                        ) : null}
                                                                        {opt.matlInfo ? (
                                                                            <div>
                                                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Material Info</p>
                                                                                <pre className="mt-1 whitespace-pre-wrap text-xs text-gray-700">{opt.matlInfo}</pre>
                                                                            </div>
                                                                        ) : null}
                                                                        {opt.units.length ? (
                                                                            <div>
                                                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Base Cabinets / Units</p>
                                                                                <div className="mt-2 space-y-2">
                                                                                    {opt.units.map((u, uIdx) => (
                                                                                        <div key={`${u.label}-${uIdx}`} className="rounded border border-gray-200 bg-white p-2 text-xs">
                                                                                            <p className="font-semibold text-gray-900">{u.label} - {u.cabinetClass}</p>
                                                                                            <p className="text-gray-700">{u.description}</p>
                                                                                            <p className="text-gray-600">Size: {u.dimensions}</p>
                                                                                            <p className="font-semibold text-gray-900">Price: {formatCurrency(u.price)}</p>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ) : null}
                                                                        {opt.lofts.length ? (
                                                                            <div>
                                                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Lofts</p>
                                                                                <div className="mt-2 space-y-2">
                                                                                    {opt.lofts.map((l, lIdx) => (
                                                                                        <div key={`${l.description}-${lIdx}`} className="rounded border border-gray-200 bg-white p-2 text-xs">
                                                                                            <p className="font-semibold text-gray-900">{l.description}</p>
                                                                                            <p className="text-gray-600">Size: {l.dimensions}</p>
                                                                                            <p className="font-semibold text-gray-900">Price: {formatCurrency(l.price)}</p>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ) : null}
                                                                        {opt.servicesList.length ? (
                                                                            <div>
                                                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Services</p>
                                                                                <div className="mt-2 space-y-2">
                                                                                    {opt.servicesList.map((s, sIdx) => (
                                                                                        <div key={`${s.category}-${sIdx}`} className="rounded border border-gray-200 bg-white p-2 text-xs">
                                                                                            <p className="font-semibold text-gray-900">{s.category}</p>
                                                                                            <p className="text-gray-700">{s.description}</p>
                                                                                            <p className="text-gray-600">
                                                                                                Qty: {s.qty ?? '-'} {s.uom}
                                                                                            </p>
                                                                                            <p className="font-semibold text-gray-900">Price: {formatCurrency(s.price)}</p>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ) : null}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                                                        Room-wise summary is not available in this response.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* --- MAIN GRID --- */}
            <main className={`xl:grid xl:grid-cols-7 xl:gap-5 xl:m-4 transition-all duration-300 ${activeCard ? 'block' : ''}`}>
                
                {!isMmtUser && (
                    <MilestonesCard
                        cardClass={getCardClass('milestones', 'xl:col-span-3 xl:bg-purple-50 xl:h-[70vh] xl:min-h-0 xl:overflow-hidden xl:rounded-3xl relative xl:pt-6 xl:pb-6 xl:px-4 min-h-0 max-h-[min(88dvh,920px)]')}
                        isMaximized={activeCard === 'milestones'}
                        currentMilestoneIndex={currentMilestoneIndex}
                        onToggleMaximize={() => toggleMaximize('milestones')}
                        onScrollLeft={() => scrollMilestoneCards('left')}
                        onScrollRight={() => scrollMilestoneCards('right')}
                        scrollRef={milestoneCardsScrollRef}
                        onOpenTask={openTaskPopup}
                        onVisitChecklist={(milestoneIndex, taskName) => {
                            const milestone = MileStonesArray.MilestonesName[milestoneIndex];
                            setChecklistContext({ milestoneIndex, milestoneName: milestone?.name ?? '', taskName });
                        }}
                        getTaskStatus={getTaskStatus}
                    />
                )}

                {!isMmtUser && (
                    <HistoryCard
                        cardClass={getCardClass('history', 'xl:col-span-2 xl:bg-purple-50 xl:h-[70vh] xl:text-center xl:font-bold xl:pt-8 xl:rounded-3xl text-gray-400 relative')}
                        onToggleMaximize={() => toggleMaximize('history')}
                        isMaximized={activeCard === 'history'}
                        historyEvents={historyEvents}
                        onViewTaskDetails={setSelectedHistoryEvent}
                        currentMilestoneIndex={currentMilestoneIndex}
                        totalMilestones={MileStonesArray.MilestonesName.length}
                        showDqcFeedback={isDesigner}
                        leadId={projectId}
                        sessionId={sessionId}
                    />
                )}

                <div className={`xl:text-center xl:font-bold ${activeCard && activeCard !== 'files' && activeCard !== 'chat' ? 'hidden' : ''} ${isMmtUser ? 'xl:col-span-7 xl:h-[70vh] xl:min-h-0' : 'xl:col-span-2 xl:h-[70vh] xl:min-h-0'}`}>
                    <div className={isMmtUser ? 'xl:h-full xl:min-h-0 xl:flex xl:flex-col' : isDesigner ? 'xl:flex xl:flex-col xl:h-full xl:min-h-0 xl:gap-4' : 'xl:grid xl:grid-rows-2 xl:h-full xl:min-h-0 xl:gap-4'}>
                        {isDesigner && !isMmtUser ? (
                            <div className="xl:flex-1 xl:min-h-0 xl:grid xl:grid-rows-2 xl:gap-4">
                                <FilesCard
                                    key={`files-${uploadsVersion}`}
                                    cardClass={getCardClass('files', 'xl:rounded-3xl xl:bg-purple-50 xl:row-span-1 xl:min-h-0 xl:text-center xl:font-bold xl:pt-8 text-gray-400 relative xl:flex xl:flex-col')}
                                    onToggleMaximize={() => toggleMaximize('files')}
                                    isMaximized={activeCard === 'files'}
                                    leadId={projectId}
                                    sessionId={sessionId}
                                    canUpload={false}
                                    userRole={authUser?.role}
                                    canDelete={false}
                                />
                                <ChatCard
                                    cardClass={getCardClass('chat', 'xl:rounded-3xl xl:bg-purple-50 xl:row-span-1 xl:text-center xl:font-bold xl:pt-8 text-gray-400 relative')}
                                    onToggleMaximize={() => toggleMaximize('chat')}
                                    isMaximized={activeCard === 'chat'}
                                />
                            </div>
                        ) : (
                            <>
                                <FilesCard
                                    key={`files-${uploadsVersion}`}
                                    cardClass={getCardClass('files', isMmtUser ? 'xl:rounded-3xl xl:bg-purple-50 xl:h-full xl:min-h-0 xl:text-center xl:font-bold xl:pt-8 text-gray-400 relative xl:flex xl:flex-col' : 'xl:rounded-3xl xl:bg-purple-50 xl:row-span-1 xl:min-h-0 xl:text-center xl:font-bold xl:pt-8 text-gray-400 relative xl:flex xl:flex-col')}
                                    onToggleMaximize={() => toggleMaximize('files')}
                                    isMaximized={activeCard === 'files'}
                                    leadId={projectId}
                                    sessionId={sessionId}
                                    canUpload={isMmtUser}
                                    userRole={authUser?.role}
                                    canDelete={isMmtUser}
                                />
                                {!isMmtUser && (
                                    <ChatCard
                                        cardClass={getCardClass('chat', 'xl:rounded-3xl xl:bg-purple-50 xl:row-span-1 xl:text-center xl:font-bold xl:pt-8 text-gray-400 relative')}
                                        onToggleMaximize={() => toggleMaximize('chat')}
                                        isMaximized={activeCard === 'chat'}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>

            </main>

            {showCancelModal && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Mark project as cancelled?</h2>
                        <p className="text-sm text-gray-600">
                            This moves the project to the <strong>Cancelled</strong> queue on the dashboard. Hold will be cleared. This action is intended for Admin, TDM, or Deputy General Manager only.
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCancelModal(false)}
                                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 disabled:opacity-60"
                                disabled={!sessionId}
                                onClick={async () => {
                                    if (!projectId || !sessionId) return;
                                    try {
                                        const res = await fetch(`${API}/api/leads/${projectId}/cancel`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${sessionId}`,
                                            },
                                        });
                                        const data = await res.json().catch(() => ({}));
                                        if (!res.ok) throw new Error(data?.message || 'Request failed');
                                        setProject((prev) =>
                                            prev
                                                ? {
                                                      ...prev,
                                                      projectStage: 'Cancelled',
                                                      isOnHold: false,
                                                      resumeAt: null,
                                                  }
                                                : prev,
                                        );
                                        setShowCancelModal(false);
                                    } catch {
                                        // optional: toast
                                    }
                                }}
                            >
                                Mark as cancelled
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showHoldModal && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Put project on hold</h2>
                        <p className="text-sm text-gray-600">
                            Select a date when this project should automatically resume.
                        </p>
                        <input
                            type="date"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                            value={holdDate}
                            onChange={(e) => setHoldDate(e.target.value)}
                        />
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowHoldModal(false);
                                    setHoldDate('');
                                }}
                                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-60"
                                disabled={!holdDate}
                                onClick={async () => {
                                    if (!projectId || !holdDate) return;
                                    try {
                                        await fetch(`${API}/api/leads/${projectId}/hold`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ resumeAt: holdDate }),
                                        });
                                        setProject((prev) =>
                                            prev ? { ...prev, isOnHold: true, resumeAt: holdDate } : prev,
                                        );
                                        setShowHoldModal(false);
                                    } catch {
                                        // ignore
                                    }
                                }}
                            >
                                Confirm hold
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {selectedHistoryEvent && (
                <ViewTaskDetailsModal
                    event={selectedHistoryEvent}
                    onClose={() => setSelectedHistoryEvent(null)}
                />
            )}

            {popupContext && (
                <TaskModal context={popupContext} onClose={closePopup}>
                    {/* ---------- Milestone 0: D1 SITE MEASUREMENT – D1 popup only for "D1 for MMT request" ---------- */}
                    {popupContext.milestoneIndex === 0 && popupContext.taskName === 'D1 for MMT request' && (
                        <PopupD1Measurement leadId={projectId} sessionId={sessionId} onSubmit={() => { recordTaskComplete(0, 'D1 for MMT request'); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 0 && popupContext.taskName === 'Group Description' && (
                        <PopupGroupDescription
                            designerPhone={authUser?.phone ?? ''}
                            clientPhone={project?.contactNo ?? ''}
                            sessionId={sessionId}
                            onMarkComplete={() => { recordTaskComplete(0, 'Group Description'); closePopup(); }}
                            onClose={closePopup}
                        />
                    )}
                    {popupContext.milestoneIndex === 0 && popupContext.taskName === 'Mail loop chain 2 initiate' && (
                        <PopupMailLoopChain
                            leadId={projectId}
                            clientEmail={project?.clientEmail ?? ''}
                            alternateClientEmail={project?.alternateClientEmail ?? ''}
                            designerEmail={authUser?.email ?? ''}
                            projectPid={project?.pid}
                            projectName={project?.projectName}
                            designManagerEmail={
                                (project as any)?.designManagerEmail ||
                                (project as any)?.design_manager_email ||
                                (project as any)?.designer_lead_email ||
                                ''
                            }
                            tdmEmail={
                                (project as any)?.tdmEmail ||
                                (project as any)?.tdm_email ||
                                ''
                            }
                            sessionId={sessionId}
                            onMarkComplete={() => { recordTaskComplete(0, 'Mail loop chain 2 initiate'); closePopup(); }}
                            onClose={closePopup}
                        />
                    )}
                    {popupContext.milestoneIndex === 0 && popupContext.taskName !== 'D1 for MMT request' && popupContext.taskName !== 'Group Description' && popupContext.taskName !== 'Mail loop chain 2 initiate' && (
                        <PopupPlaceholder message={popupContext.taskName} onMarkComplete={() => { recordTaskComplete(popupContext.milestoneIndex, popupContext.taskName); closePopup(); }} />
                    )}

                {/* ---------- Milestone 1: DQC1 – different popup per task ---------- */}
                    {popupContext.milestoneIndex === 1 && popupContext.taskName === 'First cut design + quotation discussion meeting request' && (
                        <PopupFirstCutDesign
                            designUploadFiles={designUploadFiles}
                            designFileInputRef={designFileInputRef}
                            openDesignFileUpload={openDesignFileUpload}
                            onDesignFilesSelected={onDesignFilesSelected}
                            onDesignDrop={onDesignDrop}
                            onDesignDragOver={onDesignDragOver}
                            removeDesignFile={removeDesignFile}
                            ecLocation={project?.experienceCenter || (project as any)?.experience_center || 'Experience Center'}
                            initialDate={(() => {
                                const ev = historyEvents.find(e => e.taskName === 'First cut design + quotation discussion meeting request' && (e.meta as any)?.meetingDate);
                                return (ev?.meta as any)?.meetingDate || '';
                            })()}
                            initialTime={(() => {
                                const ev = historyEvents.find(e => e.taskName === 'First cut design + quotation discussion meeting request' && (e.meta as any)?.meetingTime);
                                return (ev?.meta as any)?.meetingTime || '';
                            })()}
                            initialMode={(() => {
                                const ev = historyEvents.find(e => e.taskName === 'First cut design + quotation discussion meeting request' && (e.meta as any)?.meetingMode);
                                return (ev?.meta as any)?.meetingMode || 'online';
                            })()}
                            initialLink={(() => {
                                const ev = historyEvents.find(e => e.taskName === 'First cut design + quotation discussion meeting request' && (e.meta as any)?.meetingLink);
                                return (ev?.meta as any)?.meetingLink || '';
                            })()}
                            onSubmit={async (meta) => {
                                if (!projectId) return;
                                try {
                                    let uploadedAttachments: any[] = [];
                                    if (designUploadFiles.length > 0 && sessionId) {
                                        const fd = new FormData();
                                        if (meta?.meetingDate) fd.append('meetingDate', meta.meetingDate);
                                        if (meta?.meetingTime) fd.append('meetingTime', meta.meetingTime);
                                        if (meta?.meetingMode) fd.append('meetingMode', meta.meetingMode);
                                        if (meta?.meetingLink) fd.append('meetingLink', meta.meetingLink);
                                        
                                        designUploadFiles.forEach((f) => fd.append('files', f));
                                        const uploadRes = await fetch(
                                            `${API}/api/leads/${projectId}/first-cut-design-upload`,
                                            {
                                                method: 'POST',
                                                headers: { Authorization: `Bearer ${sessionId}` },
                                                body: fd,
                                            },
                                        );
                                        if (uploadRes.ok) {
                                            const uploadData = await uploadRes.json();
                                            if (uploadData.attachments) {
                                                uploadedAttachments = uploadData.attachments;
                                            }
                                        }
                                    }

                                    // Manual invite trigger if not already handled by upload endpoint or for re-sending
                                    await fetch(`${API}/api/leads/${projectId}/schedule-meeting-invite`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${sessionId}`,
                                        },
                                        body: JSON.stringify({
                                            meetingType: 'dqc1_first_cut',
                                            meetingDate: meta?.meetingDate,
                                            meetingTime: meta?.meetingTime,
                                            meetingMode: meta?.meetingMode,
                                            meetingLink: meta?.meetingLink,
                                            ecLocation: meta?.ecLocation || project?.experienceCenter || (project as any)?.experience_center,
                                            attachments: uploadedAttachments,
                                        }),
                                    });
                                    setDesignUploadFiles([]);
                                } catch (err) {
                                    console.error('first-cut-design submission failed', err);
                                    alert('Failed to submit design request. Please try again.');
                                }
                            }}
                            onCompleteAndProceed={(meta) => {
                                recordTaskComplete(
                                    1,
                                    'First cut design + quotation discussion meeting request',
                                    {
                                        description: 'First cut design completed (100%) and meeting request submitted.',
                                        meta: {
                                            ...meta,
                                            ecLocation: meta?.ecLocation || project?.experienceCenter || (project as any)?.experience_center,
                                        },
                                    },
                                );
                                setDesignUploadFiles([]);
                                closePopup();
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 1 && popupContext.taskName === 'meeting completed' && (
                        <PopupMeetingCompleted
                            momMinutes={momMinutes}
                            setMomMinutes={setMomMinutes}
                            momReferenceFiles={momReferenceFiles}
                            momFileInputRef={momFileInputRef}
                            openMomFileUpload={openMomFileUpload}
                            onMomFilesSelected={onMomFilesSelected}
                            onMomDrop={onMomDrop}
                            removeMomFile={removeMomFile}
                            onClose={closePopup}
                            onShareMom={async () => {
                                if (!projectId) return;
                                try {
                                    if (sessionId) {
                                        const fd = new FormData();
                                        fd.append('minutes', momMinutes);
                                        momReferenceFiles.forEach((f) => fd.append('files', f));
                                        await fetch(`${API}/api/leads/${projectId}/mom-upload`, {
                                            method: 'POST',
                                            headers: {
                                                Authorization: `Bearer ${sessionId}`,
                                            },
                                            body: fd,
                                        });
                                    }
                                    recordTaskComplete(1, 'meeting completed', {
                                        description: 'Meeting completed. Minutes of meeting shared.',
                                        details: {
                                            kind: 'mom',
                                            minutes: momMinutes,
                                            referenceFiles: momReferenceFiles.map((f) => ({ name: f.name })),
                                        },
                                    });
                                    setMomMinutes('');
                                    setMomReferenceFiles([]);
                                    setUploadsVersion((v) => v + 1);
                                    closePopup();
                                } catch (err) {
                                    console.error('mom upload failed', err);
                                    alert('Failed to save MOM. Please try again.');
                                }
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 1 && popupContext.taskName === 'DQC 1 submission - dwg + quotation' && (
                        <PopupDqcSubmission
                            leadId={projectId}
                            sessionId={sessionId}
                            dqc1EmailMeta={
                                project
                                    ? {
                                          customerName: project.projectName,
                                          ecName:
                                              (project as any).experienceCenter ||
                                              (project as any).experience_center ||
                                              'Experience Center',
                                          designerName: project.designerName ?? authUser?.name ?? 'Designer',
                                          projectValue:
                                              (project as any).orderValue ??
                                              (project as any).order_value ??
                                              0,
                                          designerEmail: authUser?.email,
                                          cc: (() => {
                                              const cc: string[] = [];
                                              const designManagerEmail =
                                                  (project as any).designManagerEmail ||
                                                  (project as any).design_manager_email ||
                                                  (project as any).designer_lead_email;
                                              const tdmEmail =
                                                  (project as any).tdmEmail ||
                                                  (project as any).tdm_email;
                                              if (designManagerEmail && typeof designManagerEmail === 'string') {
                                                  cc.push(designManagerEmail);
                                              }
                                              if (tdmEmail && typeof tdmEmail === 'string') {
                                                  cc.push(tdmEmail);
                                              }
                                              return cc;
                                          })(),
                                      }
                                    : undefined
                            }
                            onClose={closePopup}
                            onSaveDraft={closePopup}
                            onUploadSuccess={() => setUploadsVersion((v) => v + 1)}
                            onSubmit={() => { recordTaskComplete(1, 'DQC 1 submission - dwg + quotation'); closePopup(); }}
                        />
                    )}
                    {popupContext.milestoneIndex === 2 && popupContext.taskName === '10% payment collection' && projectId != null && (
                        <Popup10pPaymentCollection
                            leadId={projectId}
                            apiBase={API}
                            sessionId={sessionId}
                            onSuccess={() => {
                                setCompletedTaskKeys((prev) => Array.from(new Set([...prev, taskKey(2, '10% payment collection')])));
                                setUploadsVersion((v) => v + 1);
                                closePopup();
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 2 && popupContext.taskName === '10% payment approval' && (
                        <PopupPlaceholder message="10% payment approval is done by the finance team from their queue. Once they approve, this milestone will advance automatically—no action needed here." />
                    )}
                    {popupContext.milestoneIndex === 1 && popupContext.taskName === 'DQC 1 approval' && (
                        isDesigner ? (
                            <PopupDqcDesignerView
                                onClose={closePopup}
                                leadId={projectId}
                                sessionId={sessionId}
                                projectName={project.projectName}
                                projectRef={project.pid || `REF-${project.id}`}
                                onEditResubmit={() => {
                                    closePopup();
                                    setPopupContext({ milestoneIndex: 1, milestoneName: 'DQC1', taskName: 'DQC 1 submission - dwg + quotation' });
                                }}
                            />
                        ) : (
                            <PopupDqc1Approval
                                onClose={closePopup}
                                projectTitle={project.projectName}
                                projectRef={project.pid || `REF-${project.id}`}
                                revision={project.revision ?? undefined}
                                designerName={project.designerName ?? undefined}
                                reviewerName={authUser?.name ?? undefined}
                                reviewerInitials={getReviewerInitials(authUser?.name)}
                                reviewerRoleLabel={getReviewerRoleLabel(authUser?.role)}
                                reviewStatus="PENDING REVIEW"
                                dqc1Verdict={dqc1Verdict}
                                setDqc1Verdict={setDqc1Verdict}
                                dqc1Remarks={dqc1Remarks}
                                removeDqc1Remark={removeDqc1Remark}
                                addDqc1Remark={addDqc1Remark}
                                focusRemarkInPdf={focusRemarkInPdf}
                                newRemarkText={newRemarkText}
                                setNewRemarkText={setNewRemarkText}
                                newRemarkPriority={newRemarkPriority}
                                setNewRemarkPriority={setNewRemarkPriority}
                                dqc1PdfFile={dqc1PdfFile}
                                dqc1PdfUrl={dqc1PdfUrl}
                                dqc1PdfInputRef={dqc1PdfInputRef}
                                onDqc1PdfSelected={onDqc1PdfSelected}
                                dqc1PdfMaximized={dqc1PdfMaximized}
                                setDqc1PdfMaximized={setDqc1PdfMaximized}
                                dqc1PdfNumPages={dqc1PdfNumPages}
                                dqc1PdfPageNumber={dqc1PdfPageNumber}
                                setDqc1PdfPageNumber={setDqc1PdfPageNumber}
                                dqc1AnnotateMode={dqc1AnnotateMode}
                                setDqc1AnnotateMode={setDqc1AnnotateMode}
                                dqc1CommentPopup={dqc1CommentPopup}
                                setDqc1CommentPopup={setDqc1CommentPopup}
                                dqc1PdfViewportRef={dqc1PdfViewportRef}
                                dqc1PdfScrollRef={dqc1PdfScrollRef}
                                dqc1SelectedPin={dqc1SelectedPin}
                                setDqc1SelectedPin={setDqc1SelectedPin}
                                dqc1HighlightedPin={dqc1HighlightedPin}
                                setDqc1PdfNumPages={setDqc1PdfNumPages}
                                submitDqc1Review={submitDqc1Review}
                                dqc1SubmissionLoadError={dqc1SubmissionLoadError}
                                dqc1SubmissionNotPdf={dqc1SubmissionNotPdf}
                                dqc1SubmissionLoading={dqc1SubmissionLoading}
                                onLoadDqcSubmission={loadDqc2SubmissionFile}
                                dqcSubmissionFiles={dqcSubmissionFiles}
                                selectedDqcSubmissionFileId={selectedDqcSubmissionFileId}
                                onSelectDqcSubmissionFile={(id) => {
                                    const file = dqcSubmissionFiles.find((f) => f.id === id);
                                    if (!file) return;
                                    setSelectedDqcSubmissionFileId(id);
                                    setDqc1SubmissionLoading(true);
                                    loadDqcFileBlob(file).catch(() => {
                                        setDqc1SubmissionLoadError('Could not load selected file.');
                                        setDqc1SubmissionLoading(false);
                                    });
                                }}
                            />
                        )
                    )}

                    {popupContext.milestoneIndex === 3 && popupContext.taskName === 'D2 - masking request raise' && (
                        <PopupD2MaskingRequest
                            leadId={projectId}
                            sessionId={sessionId}
                            onSubmit={() => { recordTaskComplete(3, 'D2 - masking request raise'); closePopup(); }}
                        />
                    )}
                    {popupContext.milestoneIndex === 3 && popupContext.taskName !== 'D2 - masking request raise' && (
                        <PopupPlaceholder message={popupContext.taskName} onMarkComplete={() => { recordTaskComplete(3, popupContext.taskName); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 4 && popupContext.taskName === 'Material selection meeting + quotation discussion' && (
                        <PopupFirstCutDesign
                            designUploadFiles={designUploadFiles}
                            designFileInputRef={designFileInputRef}
                            openDesignFileUpload={openDesignFileUpload}
                            onDesignFilesSelected={onDesignFilesSelected}
                            onDesignDrop={onDesignDrop}
                            onDesignDragOver={onDesignDragOver}
                            removeDesignFile={removeDesignFile}
                            ecLocation={project?.experienceCenter || (project as any)?.experience_center || 'Experience Center'}
                            initialDate={(() => {
                                const ev = historyEvents.find(e => e.taskName === 'Material selection meeting + quotation discussion' && (e.meta as any)?.meetingDate);
                                return (ev?.meta as any)?.meetingDate || '';
                            })()}
                            initialTime={(() => {
                                const ev = historyEvents.find(e => e.taskName === 'Material selection meeting + quotation discussion' && (e.meta as any)?.meetingTime);
                                return (ev?.meta as any)?.meetingTime || '';
                            })()}
                            initialMode={(() => {
                                const ev = historyEvents.find(e => e.taskName === 'Material selection meeting + quotation discussion' && (e.meta as any)?.meetingMode);
                                return (ev?.meta as any)?.meetingMode || 'online';
                            })()}
                            initialLink={(() => {
                                const ev = historyEvents.find(e => e.taskName === 'Material selection meeting + quotation discussion' && (e.meta as any)?.meetingLink);
                                return (ev?.meta as any)?.meetingLink || '';
                            })()}
                            onSubmit={async (meta) => {
                                if (!projectId) return;
                                try {
                                    // 1. Upload files first (no email side effect) → get attachment paths
                                    let attachments: { filename: string; path: string }[] = [];
                                    if (designUploadFiles.length > 0 && sessionId) {
                                        const fd = new FormData();
                                        designUploadFiles.forEach((f) => fd.append('files', f));
                                        const uploadRes = await fetch(
                                            `${API}/api/leads/${projectId}/material-selection-upload`,
                                            {
                                                method: 'POST',
                                                headers: { Authorization: `Bearer ${sessionId}` },
                                                body: fd,
                                            },
                                        );
                                        if (uploadRes.ok) {
                                            const data = await uploadRes.json();
                                            attachments = data.attachments || [];
                                        }
                                    }

                                    // 2. Schedule meeting invite + send email WITH attachments
                                    await fetch(`${API}/api/leads/${projectId}/schedule-meeting-invite`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${sessionId}`,
                                        },
                                        body: JSON.stringify({
                                            meetingType: 'dqc2_material_selection',
                                            meetingDate: meta?.meetingDate,
                                            meetingTime: meta?.meetingTime,
                                            meetingMode: meta?.meetingMode,
                                            meetingLink: meta?.meetingLink,
                                            ecLocation: meta?.ecLocation || project?.experienceCenter || (project as any)?.experience_center,
                                            ...(attachments.length ? { attachments } : {}),
                                        }),
                                    });
                                    setDesignUploadFiles([]);
                                } catch (err) {
                                    console.error('material-selection schedule failed', err);
                                    alert('Failed to schedule meeting. Please try again.');
                                }
                            }}
                            onCompleteAndProceed={(meta) => {
                                recordTaskComplete(
                                    4,
                                    'Material selection meeting + quotation discussion',
                                    {
                                        description: 'Material selection meeting completed (100%) and meeting request submitted.',
                                        meta: {
                                            ...meta,
                                            ecLocation: meta?.ecLocation || project?.experienceCenter || (project as any)?.experience_center,
                                        },
                                    },
                                );
                                setDesignUploadFiles([]);
                                closePopup();
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 4 && popupContext.taskName === 'Material selection meeting completed' && (
                        <PopupMeetingCompleted
                            momMinutes={momMinutes}
                            setMomMinutes={setMomMinutes}
                            momReferenceFiles={momReferenceFiles}
                            momFileInputRef={momFileInputRef}
                            openMomFileUpload={openMomFileUpload}
                            onMomFilesSelected={onMomFilesSelected}
                            onMomDrop={onMomDrop}
                            removeMomFile={removeMomFile}
                            onClose={closePopup}
                            onShareMom={async () => {
                                if (!projectId) return;
                                try {
                                    let uploadedAttachments: { filename: string; path: string }[] = [];
                                    if (sessionId) {
                                        const fd = new FormData();
                                        fd.append('minutes', momMinutes);
                                        momReferenceFiles.forEach((f) => fd.append('files', f));
                                        const res = await fetch(`${API}/api/leads/${projectId}/mom-upload`, {
                                            method: 'POST',
                                            headers: {
                                                Authorization: `Bearer ${sessionId}`,
                                            },
                                            body: fd,
                                        });
                                        if (res.ok) {
                                            const data = await res.json();
                                            uploadedAttachments = data.attachments || [];
                                        }
                                    }
                                    recordTaskComplete(4, 'Material selection meeting completed', {
                                        description: 'Material selection meeting completed. Minutes of meeting shared.',
                                        meta: {
                                            attachments: uploadedAttachments,
                                        },
                                        details: {
                                            kind: 'mom',
                                            minutes: momMinutes,
                                            referenceFiles: momReferenceFiles.map((f) => ({ name: f.name })),
                                        },
                                    });
                                    setMomMinutes('');
                                    setMomReferenceFiles([]);
                                    setUploadsVersion((v) => v + 1);
                                    closePopup();
                                } catch (err) {
                                    console.error('mom upload failed', err);
                                    alert('Failed to save MOM. Please try again.');
                                }
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 4 && popupContext.taskName === 'DQC 2 submission' && (
                        <PopupDqcSubmission
                            leadId={projectId}
                            sessionId={sessionId}
                            submissionVariant="dqc2"
                            onClose={closePopup}
                            onSaveDraft={closePopup}
                            onSubmit={() => { recordTaskComplete(4, 'DQC 2 submission'); closePopup(); }}
                        />
                    )}
                    {popupContext.milestoneIndex === 4 && (popupContext.taskName === 'DQC 2 approval' || popupContext.taskName === 'DQC 2 approval ') && (
                        isDesigner ? (
                            <PopupDqcDesignerView
                                onClose={closePopup}
                                leadId={projectId}
                                sessionId={sessionId}
                                submissionVariant="dqc2"
                                projectName={project.projectName}
                                projectRef={project.pid || `REF-${project.id}`}
                                onEditResubmit={() => {
                                    closePopup();
                                    setPopupContext({
                                        milestoneIndex: 4,
                                        milestoneName: 'DQC2',
                                        taskName: 'DQC 2 submission',
                                    });
                                }}
                            />
                        ) : (
                            <PopupDqc1Approval
                                onClose={closePopup}
                                projectTitle={project.projectName}
                                projectRef={project.pid || `REF-${project.id}`}
                                revision={project.revision ?? undefined}
                                designerName={project.designerName ?? undefined}
                                reviewerName={authUser?.name ?? undefined}
                                reviewerInitials={getReviewerInitials(authUser?.name)}
                                reviewerRoleLabel={getReviewerRoleLabel(authUser?.role)}
                                reviewStatus="PENDING REVIEW"
                                dqc1Verdict={dqc1Verdict}
                                setDqc1Verdict={setDqc1Verdict}
                                dqc1Remarks={dqc1Remarks}
                                removeDqc1Remark={removeDqc1Remark}
                                addDqc1Remark={addDqc1Remark}
                                focusRemarkInPdf={focusRemarkInPdf}
                                newRemarkText={newRemarkText}
                                setNewRemarkText={setNewRemarkText}
                                newRemarkPriority={newRemarkPriority}
                                setNewRemarkPriority={setNewRemarkPriority}
                                dqc1PdfFile={dqc1PdfFile}
                                dqc1PdfUrl={dqc1PdfUrl}
                                dqc1PdfInputRef={dqc1PdfInputRef}
                                onDqc1PdfSelected={onDqc1PdfSelected}
                                dqc1PdfMaximized={dqc1PdfMaximized}
                                setDqc1PdfMaximized={setDqc1PdfMaximized}
                                dqc1PdfNumPages={dqc1PdfNumPages}
                                dqc1PdfPageNumber={dqc1PdfPageNumber}
                                setDqc1PdfPageNumber={setDqc1PdfPageNumber}
                                dqc1AnnotateMode={dqc1AnnotateMode}
                                setDqc1AnnotateMode={setDqc1AnnotateMode}
                                dqc1CommentPopup={dqc1CommentPopup}
                                setDqc1CommentPopup={setDqc1CommentPopup}
                                dqc1PdfViewportRef={dqc1PdfViewportRef}
                                dqc1PdfScrollRef={dqc1PdfScrollRef}
                                dqc1SelectedPin={dqc1SelectedPin}
                                setDqc1SelectedPin={setDqc1SelectedPin}
                                dqc1HighlightedPin={dqc1HighlightedPin}
                                setDqc1PdfNumPages={setDqc1PdfNumPages}
                                submitDqc1Review={submitDqc1Review}
                                dqc1SubmissionLoadError={dqc1SubmissionLoadError}
                                dqc1SubmissionNotPdf={dqc1SubmissionNotPdf}
                                dqc1SubmissionLoading={dqc1SubmissionLoading}
                                onLoadDqcSubmission={loadDqcSubmissionFile}
                                dqcSubmissionFiles={dqcSubmissionFiles}
                                selectedDqcSubmissionFileId={selectedDqcSubmissionFileId}
                                onSelectDqcSubmissionFile={(id) => {
                                    const file = dqcSubmissionFiles.find((f) => f.id === id);
                                    if (!file) return;
                                    setSelectedDqcSubmissionFileId(id);
                                    setDqc1SubmissionLoading(true);
                                    loadDqcFileBlob(file).catch(() => {
                                        setDqc1SubmissionLoadError('Could not load selected file.');
                                        setDqc1SubmissionLoading(false);
                                    });
                                }}
                            />
                        )
                    )}
                    {popupContext.milestoneIndex === 4 && popupContext.taskName === 'Assign project manager' && projectId != null && project && (
                        <PopupAssignProjectManager
                            leadId={projectId}
                            apiBase={API}
                            sessionId={sessionId}
                            currentPmId={project.assigned_project_manager_id}
                            currentPmName={project.projectManagerName}
                            onClose={closePopup}
                            onAssigned={() => {
                                recordTaskComplete(4, 'Assign project manager');
                                if (sessionId) {
                                    fetch(`${API}/api/leads/${projectId}`, {
                                        headers: { Authorization: `Bearer ${sessionId}` },
                                    })
                                        .then(async (res) => {
                                            const text = await res.text();
                                            if (!res.ok || !text) return null;
                                            try {
                                                return JSON.parse(text) as LeadshipTypes;
                                            } catch {
                                                return null;
                                            }
                                        })
                                        .then((data: LeadshipTypes | null) => {
                                            if (data) setProject(data);
                                        })
                                        .catch(() => {});
                                }
                                closePopup();
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 4 && popupContext.taskName === 'Project manager approval' && project && (
                        <PopupProjectManagerApproval
                            projectName={project.projectName}
                            projectManagerName={authUser?.name ?? project.projectManagerName ?? null}
                            onClose={closePopup}
                            onApprove={() => {
                                recordTaskComplete(4, 'Project manager approval');
                                closePopup();
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 4 &&
                        popupContext.taskName !== 'DQC 2 submission' &&
                        popupContext.taskName !== 'DQC 2 approval' &&
                        popupContext.taskName !== 'DQC 2 approval ' &&
                        popupContext.taskName !== 'Assign project manager' &&
                        popupContext.taskName !== 'Project manager approval' &&
                        popupContext.taskName !== 'Material selection meeting + quotation discussion' &&
                        popupContext.taskName !== 'Material selection meeting completed' && (
                        <PopupPlaceholder message={popupContext.taskName} onMarkComplete={() => { recordTaskComplete(4, popupContext.taskName); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 5 && popupContext.taskName === 'Design sign off' && (
                        <PopupFirstCutDesign
                            designUploadFiles={designUploadFiles}
                            designFileInputRef={designFileInputRef}
                            openDesignFileUpload={openDesignFileUpload}
                            onDesignFilesSelected={onDesignFilesSelected}
                            onDesignDrop={onDesignDrop}
                            onDesignDragOver={onDesignDragOver}
                            removeDesignFile={removeDesignFile}
                            ecLocation={project?.experienceCenter || (project as any)?.experience_center || 'Experience Center'}
                            initialDate={(() => {
                                const ev = historyEvents.find(e => e.taskName === 'Design sign off' && (e.meta as any)?.meetingDate);
                                return (ev?.meta as any)?.meetingDate || '';
                            })()}
                            initialTime={(() => {
                                const ev = historyEvents.find(e => e.taskName === 'Design sign off' && (e.meta as any)?.meetingTime);
                                return (ev?.meta as any)?.meetingTime || '';
                            })()}
                            initialMode={(() => {
                                const ev = historyEvents.find(e => e.taskName === 'Design sign off' && (e.meta as any)?.meetingMode);
                                return (ev?.meta as any)?.meetingMode || 'online';
                            })()}
                            initialLink={(() => {
                                const ev = historyEvents.find(e => e.taskName === 'Design sign off' && (e.meta as any)?.meetingLink);
                                return (ev?.meta as any)?.meetingLink || '';
                            })()}
                            onSubmit={async (meta) => {
                                if (!projectId) return;
                                try {
                                    let uploadedAttachments: any[] = [];
                                    if (designUploadFiles.length > 0 && sessionId) {
                                        const fd = new FormData();
                                        designUploadFiles.forEach((f) => fd.append('files', f));
                                        const uploadRes = await fetch(
                                            `${API}/api/leads/${projectId}/first-cut-design-upload`,
                                            {
                                                method: 'POST',
                                                headers: { Authorization: `Bearer ${sessionId}` },
                                                body: fd,
                                            },
                                        );
                                        if (uploadRes.ok) {
                                            const uploadData = await uploadRes.json();
                                            if (uploadData.attachments) {
                                                uploadedAttachments = uploadData.attachments;
                                            }
                                        }
                                    }

                                    await fetch(`${API}/api/leads/${projectId}/schedule-meeting-invite`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${sessionId}`,
                                        },
                                        body: JSON.stringify({
                                            meetingType: 'design_signoff',
                                            meetingDate: meta?.meetingDate,
                                            meetingTime: meta?.meetingTime,
                                            meetingMode: meta?.meetingMode,
                                            meetingLink: meta?.meetingLink,
                                            ecLocation: meta?.ecLocation || project?.experienceCenter || (project as any)?.experience_center,
                                            attachments: uploadedAttachments,
                                        }),
                                    });
                                    setDesignUploadFiles([]);
                                } catch (err) {
                                    console.error('Submit failed', err);
                                    alert('Failed to send invite. Please try again.');
                                }
                            }}
                            onCompleteAndProceed={(meta) => {
                                recordTaskComplete(
                                    5,
                                    'Design sign off',
                                    {
                                        description: 'Design sign off completed and meeting request submitted.',
                                        meta: {
                                            ...meta,
                                            ecLocation: meta?.ecLocation || project?.experienceCenter || (project as any)?.experience_center,
                                        },
                                    },
                                );
                                setDesignUploadFiles([]);
                                closePopup();
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 5 && popupContext.taskName === '40% payment approval' && (
                        <PopupPlaceholder message="40% payment approval is done by the finance team from their queue. Once they approve, this milestone will advance automatically—no action needed here." />
                    )}
                    {popupContext.milestoneIndex === 5 &&
                        popupContext.taskName !== 'meeting completed' &&
                        popupContext.taskName !== '40% collection' &&
                        popupContext.taskName !== 'Design sign off' &&
                        popupContext.taskName !== '40% payment approval' && (
                        <PopupPlaceholder message={popupContext.taskName} onMarkComplete={() => { recordTaskComplete(5, popupContext.taskName); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 5 && popupContext.taskName === 'meeting completed' && (
                        <PopupMeetingCompleted
                            momMinutes={momMinutes}
                            setMomMinutes={setMomMinutes}
                            momReferenceFiles={momReferenceFiles}
                            momFileInputRef={momFileInputRef}
                            openMomFileUpload={openMomFileUpload}
                            onMomFilesSelected={onMomFilesSelected}
                            onMomDrop={onMomDrop}
                            removeMomFile={removeMomFile}
                            onClose={closePopup}
                            show40pUpload={false}
                            onShareMom={async () => {
                                if (!projectId) return;
                                try {
                                    if (sessionId) {
                                        const fd = new FormData();
                                        fd.append('minutes', momMinutes);
                                        momReferenceFiles.forEach((f) => fd.append('files', f));
                                        await fetch(`${API}/api/leads/${projectId}/mom-upload`, {
                                            method: 'POST',
                                            headers: { Authorization: `Bearer ${sessionId}` },
                                            body: fd,
                                        });
                                    }
                                    recordTaskComplete(5, 'meeting completed', {
                                        description: 'Design sign-off meeting completed. Minutes of meeting shared.',
                                        details: {
                                            kind: 'mom',
                                            minutes: momMinutes,
                                            referenceFiles: momReferenceFiles.map((f) => ({ name: f.name })),
                                        },
                                    });
                                    setMomMinutes('');
                                    setMomReferenceFiles([]);
                                    setUploadsVersion((v) => v + 1);
                                    closePopup();
                                } catch (err) {
                                    console.error('MOM upload failed', err);
                                    alert('Failed to save. Please try again.');
                                }
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 5 && popupContext.taskName === '40% collection' && projectId != null && (
                        <Popup40pCollection
                            leadId={projectId}
                            apiBase={API}
                            sessionId={sessionId}
                            onClose={closePopup}
                            onSuccess={() => {
                                recordTaskComplete(5, '40% collection', {
                                    description: '40% collection: payment screenshots uploaded for finance review.',
                                    details: { kind: 'file_upload', fileName: '40% payment screenshots' },
                                });
                                setUploadsVersion((v) => v + 1);
                                closePopup();
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 6 && popupContext.taskName === 'Cx approval for production' && (
                        <PopupMeetingCompleted
                            momMinutes={momMinutes}
                            setMomMinutes={setMomMinutes}
                            momReferenceFiles={momReferenceFiles}
                            momFileInputRef={momFileInputRef}
                            openMomFileUpload={openMomFileUpload}
                            onMomFilesSelected={onMomFilesSelected}
                            onMomDrop={onMomDrop}
                            removeMomFile={removeMomFile}
                            onClose={closePopup}
                            onShareMom={async () => {
                                if (!projectId) return;
                                try {
                                    if (sessionId) {
                                        const fd = new FormData();
                                        fd.append('minutes', momMinutes);
                                        momReferenceFiles.forEach((f) => fd.append('files', f));
                                        await fetch(`${API}/api/leads/${projectId}/mom-upload`, {
                                            method: 'POST',
                                            headers: {
                                                Authorization: `Bearer ${sessionId}`,
                                            },
                                            body: fd,
                                        });
                                    }
                                    recordTaskComplete(6, popupContext.taskName, {
                                        description: 'Cx approval for production MOM shared.',
                                        details: {
                                            kind: 'mom',
                                            minutes: momMinutes,
                                            referenceFiles: momReferenceFiles.map((f) => ({ name: f.name })),
                                        },
                                    });
                                    setMomMinutes('');
                                    setMomReferenceFiles([]);
                                    setUploadsVersion((v) => v + 1);
                                    closePopup();
                                } catch (err) {
                                    console.error('mom upload failed', err);
                                    alert('Failed to save MOM. Please try again.');
                                }
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 6 && (popupContext.taskName === 'POC mail & Timeline submission' || popupContext.taskName === 'POC mail & Timeline submission ') && (
                        <PopupPlaceholder
                            message="POC mail & Timeline submission"
                            onMarkComplete={() => {
                                recordTaskComplete(6, 'POC mail & Timeline submission');
                                closePopup();
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 6 && popupContext.taskName !== 'Cx approval for production' && popupContext.taskName !== 'POC mail & Timeline submission' && popupContext.taskName !== 'POC mail & Timeline submission ' && (
                        <PopupPlaceholder message={popupContext.taskName} onMarkComplete={() => { recordTaskComplete(6, popupContext.taskName); closePopup(); }} />
                    )}
                </TaskModal>
            )}

            {checklistContext && (() => {
                const key = getChecklistKeyForTask(checklistContext.milestoneIndex, checklistContext.taskName);
                const definition = key ? checklistDefinitions[key] : null;
                if (!definition) return null;
                return (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
                        onClick={() => setChecklistContext(null)}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden xl:max-h-[85vh] xl:w-[40vw]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center pt-6 px-6 pb-2 flex-shrink-0">
                                <h3 className="text-lg font-bold text-gray-900">Checklist</h3>
                                <button
                                    type="button"
                                    onClick={() => setChecklistContext(null)}
                                    className="text-gray-700 bg-gray-100 hover:text-gray-700 text-2xl leading-none border border-gray-300 rounded-md p-2 font-bold text-sm"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto min-h-0">
                                <GenericMeetingChecklistPopup
                                    milestoneIndex={checklistContext.milestoneIndex}
                                    taskName={checklistContext.taskName}
                                    definition={definition}
                                    milestoneName={checklistContext.milestoneName}
                                    leadId={projectId}
                                    onSuccess={() => {
                                        const k = checklistContext;
                                        if (k) {
                                            const ck = taskKey(k.milestoneIndex, k.taskName);
                                            setCompletedChecklistKeys((prev) =>
                                                prev.includes(ck) ? prev : [...prev, ck],
                                            );
                                        }
                                        setChecklistContext(null);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
