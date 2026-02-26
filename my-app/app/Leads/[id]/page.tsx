'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
    PopupD2MaskingRequest,
    PopupPlaceholder,
    PopupGroupDescription,
    PopupMailLoopChain,
    GenericMeetingChecklistPopup,
} from './components';
import { checklistDefinitions, getChecklistKeyForTask } from './components/Checklists/checklistRegistry';

export default function ProjectDetailPage() {
    const params = useParams();
    const { user: authUser, sessionId, refreshUser } = useAuth();
    const projectId = params?.id ? Number(params.id) : null;
    
    // State to track WHICH card is maximized (null = none)
    const [activeCard, setActiveCard] = useState<string | null>(null);
    // Which milestone is "current" (shown alone when not maximized; highlighted when maximized). Next milestones are grayed.
    const [currentMilestoneIndex, setCurrentMilestoneIndex] = useState(0); // 0 = 1st, 1 = 2nd (DQC1), 2 = 3rd, 3 = D2 SITE MASKING, ...
    // Track which tasks are completed; next milestone unlocks only when all tasks in current milestone are done
    const [completedTaskKeys, setCompletedTaskKeys] = useState<string[]>([]);

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
    // Which milestone popup is open (null = closed). Lets you show different popup content per milestone/task.
    const [popupContext, setPopupContext] = useState<{ milestoneIndex: number; milestoneName: string; taskName: string } | null>(null);
    // Checklist popup (opened from "Visit checklist" in milestone task menu)
    const [checklistContext, setChecklistContext] = useState<{ milestoneIndex: number; taskName: string } | null>(null);
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
        fetch(`http://localhost:3001/api/leads/${projectId}`)
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
        fetch(`http://localhost:3001/api/leads/${projectId}`)
            .then(async (res) => {
                const text = await res.text();
                if (!res.ok || !text) return null;
                try { return JSON.parse(text) as LeadshipTypes; } catch { return null; }
            })
            .then((data: LeadshipTypes | null) => { if (data) setProject(data); })
            .catch(() => {});
    }, [popupContext?.milestoneIndex, popupContext?.taskName, projectId, refreshUser]);

    // Load and maintain history for this lead (recorded on server)
    useEffect(() => {
        if (projectId == null) return;
        fetch(`http://localhost:3001/api/leads/${projectId}/history`)
            .then(async (res) => {
                const text = await res.text();
                if (!res.ok || !text) return [];
                try { const d = JSON.parse(text); return Array.isArray(d) ? d : []; } catch { return []; }
            })
            .then((data: HistoryEvent[]) => setHistoryEvents(data))
            .catch(() => setHistoryEvents([]));
    }, [projectId]);

    const [image, setImage] = useState<ImageType[]>([
        {id:1, img:"/profile1.jpg"},
        {id:2, img:"/profile2.jpg"},
        {id:3, img:"/profile3.jpg"},
        {id:4, img:"/profile4.jpg"},
    ]);

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
        const maxId = image.length > 0 ? Math.max(...image.map(img => img.id)) : 0;
        const newImage: ImageType = {
            id: maxId + 1,
            img: "/profile1 .jpg"
        };
        setImage([...image, newImage]);
    }
   
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
            if (taskName === 'DQC 1 approval' || taskName === 'Design sign off') setDqc1Verdict(null);
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
        // Persist so history is recorded and maintained
        if (projectId != null) {
            fetch(`http://localhost:3001/api/leads/${projectId}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(full),
            }).catch((err) => console.error('Failed to persist history event:', err));
        }
    };

    // Record a task completion in history and mark the task complete (keeps history in sync with milestones).
    const recordTaskComplete = (
        milestoneIndex: number,
        taskName: string,
        options?: { details?: HistoryEvent['details']; description?: string }
    ) => {
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
        markTaskComplete(milestoneIndex, taskName);
    };

    const submitDqc1Review = () => {
        if (popupContext && dqc1Verdict) {
            addHistoryEvent({
                type: 'completed',
                taskName: popupContext.taskName,
                milestoneName: popupContext.milestoneName,
                description: `${popupContext.taskName} completed. Design QC review submitted.`,
                user: { name: authUser?.name ?? 'Current User', avatar: authUser?.profileImage },
                details: {
                    kind: 'dqc_review',
                    verdict: dqc1Verdict,
                    pdfName: dqc1PdfFile?.name,
                    remarks: dqc1Remarks.map((r) => ({ priority: r.priority, text: r.text })),
                },
            });
            markTaskComplete(popupContext.milestoneIndex, popupContext.taskName);
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
                            await fetch(`http://localhost:3001/api/leads/${projectId}/resume`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                            });
                            setProject((prev) => (prev ? { ...prev, isOnHold: false, resumeAt: null } : prev));
                        } catch {
                            // ignore
                        }
                    }}
                />
            )}

            {blockedTaskMessage && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg shadow-lg animate-pulse">
                    {blockedTaskMessage}
                </div>
            )}

            {/* --- MAIN GRID --- */}
            <main className={`xl:grid xl:grid-cols-7 xl:gap-5 xl:m-4 transition-all duration-300 ${activeCard ? 'block' : ''}`}>
                
                <MilestonesCard
                    cardClass={getCardClass('milestones', 'xl:col-span-3 xl:bg-purple-50 xl:h-[70vh] xl:rounded-3xl relative xl:pt-6 xl:pb-6 xl:px-4')}
                    isMaximized={activeCard === 'milestones'}
                    currentMilestoneIndex={currentMilestoneIndex}
                    onToggleMaximize={() => toggleMaximize('milestones')}
                    onScrollLeft={() => scrollMilestoneCards('left')}
                    onScrollRight={() => scrollMilestoneCards('right')}
                    scrollRef={milestoneCardsScrollRef}
                    onOpenTask={openTaskPopup}
                    onVisitChecklist={(milestoneIndex, taskName) => setChecklistContext({ milestoneIndex, taskName })}
                    getTaskStatus={getTaskStatus}
                />

                <HistoryCard
                    cardClass={getCardClass('history', 'xl:col-span-2 xl:bg-purple-50 xl:h-[70vh] xl:text-center xl:font-bold xl:pt-8 xl:rounded-3xl text-gray-400 relative')}
                    onToggleMaximize={() => toggleMaximize('history')}
                    isMaximized={activeCard === 'history'}
                    historyEvents={historyEvents}
                    onViewTaskDetails={setSelectedHistoryEvent}
                    currentMilestoneIndex={currentMilestoneIndex}
                    totalMilestones={MileStonesArray.MilestonesName.length}
                />

                <div className={`xl:col-span-2 xl:h-full xl:text-center xl:font-bold ${activeCard && activeCard !== 'files' && activeCard !== 'chat' ? 'hidden' : ''}`}>
                    <div className="xl:grid xl:grid-rows-2 xl:h-full xl:gap-4">
                        <FilesCard
                            cardClass={getCardClass('files', 'xl:rounded-3xl xl:bg-purple-50 xl:row-span-1 xl:text-center xl:font-bold xl:pt-8 text-gray-400 relative')}
                            onToggleMaximize={() => toggleMaximize('files')}
                            isMaximized={activeCard === 'files'}
                        />
                        <ChatCard
                            cardClass={getCardClass('chat', 'xl:rounded-3xl xl:bg-purple-50 xl:row-span-1 xl:text-center xl:font-bold xl:pt-8 text-gray-400 relative')}
                            onToggleMaximize={() => toggleMaximize('chat')}
                            isMaximized={activeCard === 'chat'}
                        />
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
                                        await fetch(`http://localhost:3001/api/leads/${projectId}/hold`, {
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
                        <PopupD1Measurement sessionId={sessionId} onSubmit={() => { recordTaskComplete(0, 'D1 for MMT request'); closePopup(); }} />
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
                            onSubmit={() => {
                                recordTaskComplete(1, 'First cut design + quotation discussion meeting request', {
                                    description: 'First cut design uploaded and meeting request submitted.',
                                    details: designUploadFiles.length > 0 ? { kind: 'file_upload', fileName: designUploadFiles.map((f) => f.name).join(', '), status: 'Uploaded' } : undefined,
                                });
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
                            onShareMom={() => {
                                recordTaskComplete(1, 'meeting completed', {
                                    description: 'Meeting completed. Minutes of meeting shared.',
                                    details: { kind: 'mom', minutes: momMinutes, referenceFiles: momReferenceFiles.map((f) => ({ name: f.name })) },
                                });
                                closePopup();
                            }}
                        />
                    )}
                    {popupContext.milestoneIndex === 1 && popupContext.taskName === 'Design finalisation meeting request' && (
                        <PopupPlaceholder message="Design finalisation meeting request" onMarkComplete={() => { recordTaskComplete(1, 'Design finalisation meeting request'); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 1 && popupContext.taskName === 'DQC 1 submission - dwg + quotation' && (
                        <PopupPlaceholder message="Hi from DQC 1 submission - dwg + quotation" onMarkComplete={() => { recordTaskComplete(1, 'DQC 1 submission - dwg + quotation'); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 2 && popupContext.taskName === '10% payment collection' && (
                        <PopupPlaceholder message="10% payment collection" onMarkComplete={() => { recordTaskComplete(2, '10% payment collection'); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 2 && popupContext.taskName === '10% payment approval' && (
                        <PopupPlaceholder message="10% payment approval" onMarkComplete={() => { recordTaskComplete(2, '10% payment approval'); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 1 && popupContext.taskName === 'DQC 1 approval' && (
                        <PopupDqc1Approval
                            onClose={closePopup}
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
                        />
                    )}

                    {popupContext.milestoneIndex === 3 && popupContext.taskName === 'D2 - masking request raise' && (
                        <PopupD2MaskingRequest onSubmit={() => { recordTaskComplete(3, 'D2 - masking request raise'); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 3 && popupContext.taskName !== 'D2 - masking request raise' && (
                        <PopupPlaceholder message={popupContext.taskName} onMarkComplete={() => { recordTaskComplete(3, popupContext.taskName); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 4 && (
                        <PopupPlaceholder message={popupContext.taskName} onMarkComplete={() => { recordTaskComplete(4, popupContext.taskName); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 5 && popupContext.taskName === 'Design sign off' && (
                        <PopupDqc1Approval
                            onClose={closePopup}
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
                        />
                    )}
                    {popupContext.milestoneIndex === 5 && popupContext.taskName !== 'Design sign off' && (
                        <PopupPlaceholder message={popupContext.taskName} onMarkComplete={() => { recordTaskComplete(5, popupContext.taskName); closePopup(); }} />
                    )}
                    {popupContext.milestoneIndex === 6 && (
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
                                recordTaskComplete(6, popupContext.taskName, {
                                    description: 'Meeting completed & 40% payment request shared.',
                                    details: { kind: 'mom', minutes: momMinutes, referenceFiles: momReferenceFiles.map((f) => ({ name: f.name })) },
                                });
                                closePopup();
                            }}
                        />
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
                                    onSuccess={() => setChecklistContext(null)}
                                />
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}