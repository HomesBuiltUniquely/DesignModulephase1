'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
} from './components';

export default function ProjectDetailPage() {
    const params = useParams();
    const projectId = params?.id ? Number(params.id) : null;
    
    // State to track WHICH card is maximized (null = none)
    const [activeCard, setActiveCard] = useState<string | null>(null);
    // Which milestone is "current" (shown alone when not maximized; highlighted when maximized). Next milestones are grayed.
    const [currentMilestoneIndex, setCurrentMilestoneIndex] = useState(6); // 0 = 1st, 1 = 2nd (DQC1), 2 = 3rd, 3 = D2 SITE MASKING, ...
    // Which milestone popup is open (null = closed). Lets you show different popup content per milestone/task.
    const [popupContext, setPopupContext] = useState<{ milestoneIndex: number; milestoneName: string; taskName: string } | null>(null);
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

    // Progress history: activity log for View Task Details
    const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>(() => {
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
        const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const oct24 = new Date(now.getFullYear(), 9, 24, 9, 15).toISOString();
        const oct23 = new Date(now.getFullYear(), 9, 23, 16, 30).toISOString();
        return [
            {
                id: 'ev-1',
                type: 'completed',
                taskName: 'DQC 1 approval',
                milestoneName: 'DQC1',
                timestamp: twoHoursAgo,
                description: 'DQC 1 approval completed. Design QC review submitted with verdict and remarks.',
                user: { name: 'Saeed K.', avatar: '/profile1.jpg' },
                details: {
                    kind: 'dqc_review',
                    verdict: 'approved_with_changes',
                    pdfName: 'Kitchen_Design_Rev2.pdf',
                    remarks: [
                        { priority: 'high', text: 'Dimension Issue: Missing cabinet clearance dimensions on Wall B.' },
                        { priority: 'medium', text: 'Material Issue: Check backsplash material compatibility with induction heat specs.' },
                    ],
                },
            },
            {
                id: 'ev-2',
                type: 'delayed',
                taskName: 'Task 1',
                timestamp: fiveHoursAgo,
                description: 'Task 1 status: On time → Delayed. System bottleneck detected in backend API response times.',
                user: { name: 'Alex M.', avatar: '/profile2.jpg' },
            },
            {
                id: 'ev-3',
                type: 'note',
                timestamp: yesterday,
                description: 'Note added to project.',
                user: { name: 'Kavilaash R.', avatar: '/profile3.jpg' },
                details: { kind: 'note', noteText: 'Still waiting for the final site measurement data from the vendor before we can commit to the foundation phase.' },
            },
            {
                id: 'ev-4',
                type: 'owner_change',
                timestamp: oct24,
                description: 'Owner changed: Alex → Kavilaash. Handover of Phase 1 responsibilities completed.',
                user: { name: 'System' },
            },
            {
                id: 'ev-5',
                type: 'file_upload',
                taskName: 'Design PDF upload',
                timestamp: oct23,
                description: 'Design PDF uploaded.',
                user: { name: 'Saeed K.', avatar: '/profile1.jpg' },
                details: { kind: 'file_upload', fileName: 'Final_Blueprint_V2.pdf', size: '4.2 MB', status: 'Ready for review' },
            },
            {
                id: 'ev-6',
                type: 'completed',
                taskName: 'D1 for MMT request',
                milestoneName: 'D1 SITE MEASUREMENT',
                timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'D1 MMT request submitted with date, time and assignment.',
                user: { name: 'Alex M.', avatar: '/profile2.jpg' },
                details: { kind: 'd1_request', date: '2025-02-05', time: '10:00 AM', assignedExecutive: 'Site Team A' },
            },
            {
                id: 'ev-7',
                type: 'completed',
                taskName: 'meeting completed',
                milestoneName: 'DQC1',
                timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'Meeting completed. MOM shared with reference files.',
                user: { name: 'Kavilaash R.', avatar: '/profile3.jpg' },
                details: { kind: 'mom', minutes: 'Finalised layout and material choices. Client approved backsplash option B. Next: DQC 1 submission by EOW.', referenceFiles: [{ name: 'Meeting_Notes.pdf', size: '120 KB' }, { name: 'Layout_v3.dwg', size: '2.1 MB' }] },
            },
        ];
    });
    const [selectedHistoryEvent, setSelectedHistoryEvent] = useState<HistoryEvent | null>(null);

    // Fake projects data (same as Dashboard for now)
    const projects: LeadshipTypes[] = [
        { id: 1, pid: "P001", projectName: "Bharath D", projectStage: "Active", createAt: "2023-01-01T10:00:00.000Z", updateAt: "2023-01-02T14:30:00.000Z" },
        { id: 2, pid: "P002", projectName: "Shivram", projectStage: "Active", createAt: "2023-02-01T09:15:00.000Z", updateAt: "2023-02-02T11:00:00.000Z" },
        { id: 3, pid: "P003", projectName: "Gokulnath", projectStage: "Inactive", createAt: "2023-03-01T08:00:00.000Z", updateAt: "2023-03-02T16:45:00.000Z" },
        { id: 4, pid: "P004", projectName: "Riverside", projectStage: "20-60%", createAt: "2024-01-15T10:30:00.000Z", updateAt: "2024-02-01T09:00:00.000Z" },
        { id: 5, pid: "P005", projectName: "Downtown", projectStage: "10-20%", createAt: "2024-03-10T14:00:00.000Z", updateAt: "2024-04-05T11:20:00.000Z" },
    ];
    
    const [image, setImage] = useState<ImageType[]>([
        {id:1, img:"/profile1.jpg"},
        {id:2, img:"/profile2.jpg"},
        {id:3, img:"/profile3.jpg"},
        {id:4, img:"/profile4.jpg"},
    ]);

    const project = projects.find(p => p.id === projectId);
                                                                                               
    if (!project) {
        return <div className="p-8">Project Not Found</div>;
    }

    const handleImageAdding = () => {
        const maxId = image.length > 0 ? Math.max(...image.map(img => img.id)) : 0;
        const newImage: ImageType = {
            id: maxId + 1,
            img: "/profile1.jpg"
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

    useEffect(() => {
        return () => {
            if (dqc1PdfUrl) URL.revokeObjectURL(dqc1PdfUrl);
        };
    }, [dqc1PdfUrl]);

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
            id: `ev-${Date.now()}`,
            timestamp: new Date().toISOString(),
        };
        setHistoryEvents((prev) => [full, ...prev]);
    };

    const submitDqc1Review = () => {
        if (popupContext && dqc1Verdict) {
            addHistoryEvent({
                type: 'completed',
                taskName: popupContext.taskName,
                milestoneName: popupContext.milestoneName,
                description: `${popupContext.taskName} completed. Design QC review submitted.`,
                user: { name: 'Current User', avatar: '/profile1.jpg' },
                details: {
                    kind: 'dqc_review',
                    verdict: dqc1Verdict,
                    pdfName: dqc1PdfFile?.name,
                    remarks: dqc1Remarks.map((r) => ({ priority: r.priority, text: r.text })),
                },
            });
        }
        if (dqc1Verdict === 'approved') {
            setCurrentMilestoneIndex((prev) => Math.min(prev + 1, 6));
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

    const getTaskStatus = (taskIndex: number, total: number) => {
        if (taskIndex === 0) return { icon: 'completed' as const, subtitle: 'Completed on Dec 2', tags: ['ON-TIME'] as const };
        if (taskIndex === 1) return { icon: 'current' as const, subtitle: 'Target: Dec 08', tags: ['CURRENT', 'ON-TIME', 'ACTION'] as const };
        if (taskIndex === 2) return { icon: 'delayed' as const, subtitle: 'Awaiting MMT to upload files', tags: ['DELAYED'] as const };
        return { icon: 'pending' as const, subtitle: 'Not started', tags: ['PENDING'] as const };
    };

    return (
        <div className='bg-slate-900 min-h-screen'>
            {!activeCard && (
                <LeadDetailHeader
                    project={project}
                    image={image}
                    onAddImage={handleImageAdding}
                    currentMilestoneIndex={currentMilestoneIndex}
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

            {selectedHistoryEvent && (
                <ViewTaskDetailsModal
                    event={selectedHistoryEvent}
                    onClose={() => setSelectedHistoryEvent(null)}
                />
            )}

            {popupContext && (
                <TaskModal context={popupContext} onClose={closePopup}>
                    {popupContext.milestoneIndex === 0 && <PopupD1Measurement />}

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
                        />
                    )}
                    {popupContext.milestoneIndex === 1 && popupContext.taskName === 'Material selection meeting + quotation discussion' && <PopupPlaceholder />}
                    {popupContext.milestoneIndex === 1 && popupContext.taskName === 'DQC 1 submission - dwg + quotation' && <PopupPlaceholder message="Hi from DQC 1 submission - dwg + quotation" />}
                    {popupContext.milestoneIndex === 2 && popupContext.taskName === '10% payment collection' && <PopupPlaceholder />}
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

                    {popupContext.milestoneIndex === 3 && popupContext.taskName === 'D2 - masking request raise' && <PopupD2MaskingRequest />}
                    {popupContext.milestoneIndex === 3 && popupContext.taskName !== 'D2 - masking request raise' && <PopupPlaceholder message="Add your popup content for D2 SITE MASKING here" />}
                    {popupContext.milestoneIndex === 4 && <PopupPlaceholder message="Add your popup content for DQC2 here" />}
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
                    {popupContext.milestoneIndex === 5 && popupContext.taskName !== 'Design sign off' && <PopupPlaceholder message="Add your popup content for 40% PAYMENT here" />}
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
                        />
                    )}
                </TaskModal>
            )}
        </div>
    );
}