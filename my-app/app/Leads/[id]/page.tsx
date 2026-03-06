'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { LeadshipTypes } from '../../Components/Types/Types';
import MileStonesArray from '@/app/Components/Types/MileStoneArray';
import type { ImageType, QCRemark, HistoryEvent } from './types';
import {
    LeadDetailHeader,
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
    PopupGroupDescription,
    PopupMailLoopChain,
    GenericMeetingChecklistPopup,
} from './components';
import { checklistDefinitions, getChecklistKeyForTask } from './components/Checklists/checklistRegistry';
import { getApiBase } from '@/app/lib/apiBase';

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

    useEffect(() => {
        const milestone = MileStonesArray.MilestonesName[currentMilestoneIndex];
        if (!milestone || currentMilestoneIndex >= 6) return;
        const allDone = milestone.taskList.every((t: string) =>
            completedTaskKeys.includes(taskKey(currentMilestoneIndex, t))
        );
        if (allDone) setCurrentMilestoneIndex((prev) => Math.min(prev + 1, 6));
    }, [completedTaskKeys, currentMilestoneIndex]);

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
    const [showHoldModal, setShowHoldModal] = useState(false);
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

    useEffect(() => {
        if (projectId == null) {
            setProjectLoaded(true);
            return;
        }
        setProjectLoaded(false);
        fetch(`${API}/api/leads/${projectId}`)
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
    }, [projectId]);

    // When Group Description popup opens, auto-fetch latest profile (designer phone) and lead (client contactNo)
    useEffect(() => {
        const isGroupDesc = popupContext?.milestoneIndex === 0 && popupContext?.taskName === 'Group Description';
        if (!isGroupDesc || projectId == null) return;
        refreshUser();
        fetch(`${API}/api/leads/${projectId}`)
            .then(async (res) => {
                const text = await res.text();
                if (!res.ok || !text) return null;
                try { return JSON.parse(text) as LeadshipTypes; } catch { return null; }
            })
            .then((data: LeadshipTypes | null) => { if (data) setProject(data); })
            .catch(() => {});
    }, [popupContext?.milestoneIndex, popupContext?.taskName, projectId, refreshUser]);

    // Load history from server (use credentials so we get full list; don't overwrite with empty on error)
    const loadHistory = useCallback(() => {
        if (projectId == null) return;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;
        fetch(`${API}/api/leads/${projectId}/history`, { headers, credentials: 'include' })
            .then(async (res) => {
                const text = await res.text();
                if (!res.ok || !text) return [];
                try { const d = JSON.parse(text); return Array.isArray(d) ? d : []; } catch { return []; }
            })
            .then((data: HistoryEvent[]) => setHistoryEvents(data))
            .catch(() => { /* keep existing state on error instead of clearing */ });
    }, [projectId, sessionId]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // Restore completed tasks from DB so it persists across refresh
    useEffect(() => {
        if (projectId == null) return;
        fetch(`${API}/api/leads/${projectId}/completions`)
            .then((res) => res.text().then((t) => { try { return t ? JSON.parse(t) : []; } catch { return []; } }))
            .then((rows: Array<{ milestoneIndex: number; taskName: string }>) => {
                if (!Array.isArray(rows)) return;
                const keys = rows
                    .filter((r) => typeof r?.milestoneIndex === 'number' && typeof r?.taskName === 'string')
                    .map((r) => taskKey(r.milestoneIndex, r.taskName));
                setCompletedTaskKeys(Array.from(new Set(keys)));
            })
            .catch(() => {});
    }, [projectId]);

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
            .then((data: { drawing?: { id: number; originalName: string }; quotation?: { id: number; originalName: string } } | null) => {
                if (data === null) return;
                const drawing = data?.drawing;
                const quotation = data?.quotation;
                const fileToLoad = drawing ?? quotation ?? null;
                if (!fileToLoad) {
                    setDqc1SubmissionLoadError('No DQC submission files found for this lead.');
                    setDqc1SubmissionLoading(false);
                    return;
                }
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
                    })
                    .catch((err) => {
                        setDqc1SubmissionLoadError(err?.message || 'Could not load the submitted file. Use "Choose PDF" to load a file manually.');
                        setDqc1SubmissionLoading(false);
                    });
            })
            .catch(() => {
                setDqc1SubmissionLoadError('Could not load DQC submission files. Check your connection and try again.');
                setDqc1SubmissionLoading(false);
            });
    }, [projectId, sessionId]);

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
            .then((data: { drawing?: { id: number; originalName: string }; quotation?: { id: number; originalName: string } } | null) => {
                if (data === null) return;
                const drawing = data?.drawing;
                const quotation = data?.quotation;
                const fileToLoad = drawing ?? quotation ?? null;
                if (!fileToLoad) {
                    setDqc1SubmissionLoadError('No DQC 2 submission files found for this lead.');
                    setDqc1SubmissionLoading(false);
                    return;
                }
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
                    })
                    .catch((err) => {
                        setDqc1SubmissionLoadError(err?.message || 'Could not load the submitted file.');
                        setDqc1SubmissionLoading(false);
                    });
            })
            .catch(() => {
                setDqc1SubmissionLoadError('Could not load DQC 2 submission files.');
                setDqc1SubmissionLoading(false);
            });
    }, [projectId, sessionId]);

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
        // Only allow opening tasks for the current or past milestones; next milestones unlock after current is completed
        if (milestoneIndex > currentMilestoneIndex) {
            setBlockedTaskMessage('Complete the current milestone first.');
            setTimeout(() => setBlockedTaskMessage(null), 3000);
            return;
        }
        const milestone = MileStonesArray.MilestonesName[milestoneIndex];
        if (milestone) {
            setPopupContext({ milestoneIndex, milestoneName: milestone.name, taskName });
            if (taskName === 'DQC 1 approval' || taskName === 'DQC 2 approval' || taskName === 'DQC 2 approval ') setDqc1Verdict(null);
        }
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
            if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;
            fetch(`${API}/api/leads/${projectId}/history`, {
                method: 'POST',
                headers,
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
            fetch(`${API}/api/leads/${projectId}/complete-task`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ milestoneIndex, taskName, meta: options?.meta }),
            }).catch(() => {});
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
                    // For DQC2, auto-complete all tasks in the DQC2 milestone and jump milestone index to 40% PAYMENT.
                    const dqc2Milestone = MileStonesArray.MilestonesName[4];
                    dqc2Milestone.taskList.forEach((t: string) => {
                        fetch(`${API}/api/leads/${projectId}/complete-task`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ milestoneIndex: 4, taskName: t }),
                        }).catch(() => {});
                        markTaskComplete(4, t);
                    });
                    // Force UI to show 40% PAYMENT as current milestone after DQC2 approval.
                    setCurrentMilestoneIndex(5);
                } else {
                    // DQC1: mark only the approval task; other tasks should already be completed manually.
                    fetch(`${API}/api/leads/${projectId}/complete-task`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ milestoneIndex, taskName }),
                    }).catch(() => {});
                    markTaskComplete(milestoneIndex, taskName);
                }
            }
            if (projectId != null) {
                fetch(`${API}/api/leads/${projectId}/dqc-review`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(sessionId ? { Authorization: `Bearer ${sessionId}` } : {}) },
                    body: JSON.stringify({
                        verdict: dqc1Verdict,
                        remarks: dqc1Remarks.map((r) => ({
                            priority: r.priority,
                            text: r.text,
                            page: r.page,
                            xPct: r.xPct,
                            yPct: r.yPct,
                            pinNumber: r.pinNumber,
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
                        onLoadDqcSubmission={loadDqcSubmissionFile}
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
                    hideNavTabs={isMmtUser}
                    hideStepper={isMmtUser}
                    hideProlanceHoldResume={isMmtUser}
                />
            )}

            {blockedTaskMessage && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg shadow-lg animate-pulse">
                    {blockedTaskMessage}
                </div>
            )}

            {/* --- MAIN GRID --- */}
            <main className={`xl:grid xl:grid-cols-7 xl:gap-5 xl:m-4 transition-all duration-300 ${activeCard ? 'block' : ''}`}>
                
                {!isMmtUser && (
                    <MilestonesCard
                        cardClass={getCardClass('milestones', 'xl:col-span-3 xl:bg-purple-50 xl:h-[70vh] xl:rounded-3xl relative xl:pt-6 xl:pb-6 xl:px-4')}
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
                            clientEmail={project?.clientEmail ?? ''}
                            designerEmail={authUser?.email ?? ''}
                            projectPid={project?.pid}
                            projectName={project?.projectName}
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
                            onSubmit={async (meta) => {
                                if (!projectId) return;
                                try {
                                    if (designUploadFiles.length > 0 && sessionId) {
                                        const fd = new FormData();
                                        designUploadFiles.forEach((f) =>
                                            fd.append('files', f),
                                        );
                                        await fetch(
                                            `${API}/api/leads/${projectId}/first-cut-design-upload`,
                                            {
                                                method: 'POST',
                                                headers: {
                                                    Authorization: `Bearer ${sessionId}`,
                                                },
                                                body: fd,
                                            },
                                        );
                                    }

                                    // Trigger customer email: DQC1 – First Cut Design Discussion Scheduled
                                    try {
                                        const customerEmail = project?.clientEmail;
                                        const customerName = project?.projectName;
                                        const designerDisplayName = project?.designerName || authUser?.name || undefined;
                                        const matchedDesignerAvatar =
                                            project?.designerName
                                                ? image.find(
                                                      (u) =>
                                                          u.name &&
                                                          u.name.trim().toLowerCase() ===
                                                              project.designerName!.trim().toLowerCase(),
                                                  )?.img
                                                : undefined;
                                        const designerAvatarUrl = matchedDesignerAvatar || authUser?.profileImage || undefined;

                                        if (customerEmail && customerName) {
                                            await fetch('/api/email/send-dqc1-first-cut-design-scheduled', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                },
                                                body: JSON.stringify({
                                                    to: customerEmail,
                                                    customerName,
                                                    meetingDate: meta?.meetingDate || null,
                                                    meetingTime: meta?.meetingTime || null,
                                                    designerName: designerDisplayName,
                                                    designerTitle: 'Lead Designer, HUB Interior',
                                                    designerAvatarUrl,
                                                }),
                                            });
                                        }
                                    } catch (emailErr) {
                                        console.error('Failed to send first-cut design scheduled email', emailErr);
                                    }

                                    recordTaskComplete(
                                        1,
                                        'First cut design + quotation discussion meeting request',
                                        {
                                            description:
                                                'First cut design uploaded and meeting request submitted.',
                                            details:
                                                designUploadFiles.length > 0
                                                    ? {
                                                          kind: 'file_upload',
                                                          fileName:
                                                              designUploadFiles
                                                                  .map(
                                                                      (f) =>
                                                                          f.name,
                                                                  )
                                                                  .join(', '),
                                                          status: 'Uploaded',
                                                      }
                                                    : undefined,
                                            meta: {
                                                meetingDate: meta?.meetingDate || null,
                                                meetingTime: meta?.meetingTime || null,
                                            },
                                        },
                                    );
                                    setDesignUploadFiles([]);
                                    closePopup();
                                } catch (err) {
                                    console.error(
                                        'first-cut-design upload failed',
                                        err,
                                    );
                                    alert(
                                        'Failed to upload design files. Please try again.',
                                    );
                                }
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
                    {popupContext.milestoneIndex === 1 && popupContext.taskName === 'Design finalisation meeting request' && (
                        <PopupPlaceholder message="Design finalisation meeting request" onMarkComplete={() => { recordTaskComplete(1, 'Design finalisation meeting request'); closePopup(); }} />
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
                    {popupContext.milestoneIndex === 2 && popupContext.taskName === '10% payment collection' && (
                        <PopupPlaceholder message="10% payment collection" onMarkComplete={() => { recordTaskComplete(2, '10% payment collection'); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 2 && popupContext.taskName === '10% payment approval' && (
                        <PopupPlaceholder message="10% payment approval" onMarkComplete={() => { recordTaskComplete(2, '10% payment approval'); closePopup(); }} />
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
                            />
                        )
                    )}
                    {popupContext.milestoneIndex === 4 && popupContext.taskName !== 'DQC 2 submission' && popupContext.taskName !== 'DQC 2 approval' && popupContext.taskName !== 'DQC 2 approval ' && (
                        <PopupPlaceholder message={popupContext.taskName} onMarkComplete={() => { recordTaskComplete(4, popupContext.taskName); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 5 && popupContext.taskName !== 'meeting completed & 40% payment request' && (
                        <PopupPlaceholder message={popupContext.taskName} onMarkComplete={() => { recordTaskComplete(5, popupContext.taskName); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 5 && popupContext.taskName === 'meeting completed & 40% payment request' && (
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
                            onShareMom={() => {
                                recordTaskComplete(5, popupContext.taskName, {
                                    description: 'Meeting completed & 40% payment request shared.',
                                    details: { kind: 'mom', minutes: momMinutes, referenceFiles: momReferenceFiles.map((f) => ({ name: f.name })) },
                                });
                                setUploadsVersion((v) => v + 1);
                                closePopup();
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 6 && (
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