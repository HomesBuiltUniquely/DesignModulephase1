'use client';

import { useParams, useRouter } from 'next/navigation';
import { Key, useRef, useState } from 'react';
// Assuming types are imported correctly. If not, I defined a mock below.
import { LeadshipTypes } from '../../Components/Types/Types';
import MileStonesArray from '@/app/Components/Types/MileStoneArray';

// Ensure MileStonesArray has a valid structure
// Example:
// const MileStonesArray = { MilestonesName: ['Milestone 1', 'Milestone 2', 'Milestone 3'] };

type ImageType = {
    id: number;
    img: string;
};

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params?.id ? Number(params.id) : null;

    // State to track WHICH card is maximized (null = none)
    const [activeCard, setActiveCard] = useState<string | null>(null);
    // Which milestone is shown in the card (change this to switch title + tasks + which popup opens)
    const [selectedMilestoneIndex, setSelectedMilestoneIndex] = useState(0);
    // Which milestone popup is open (null = closed). Lets you show different popup content per milestone/task.
    const [popupContext, setPopupContext] = useState<{ milestoneIndex: number; milestoneName: string; taskName: string } | null>(null);
    // For "DQC 1 approval" task: show different popup content based on Approved vs Rejected (set when user picks in popup).
    const [dqc1ApprovalChoice, setDqc1ApprovalChoice] = useState<'approved' | 'rejected' | null>(null);
    // Design upload (First cut design popup): selected files
    const [designUploadFiles, setDesignUploadFiles] = useState<File[]>([]);
    const designFileInputRef = useRef<HTMLInputElement>(null);

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
        const milestone = MileStonesArray.MilestonesName[milestoneIndex];
        if (milestone) {
            setPopupContext({ milestoneIndex, milestoneName: milestone.name, taskName });
            setDqc1ApprovalChoice(null); // reset so user picks again when opening "DQC 1 approval"
        }
    };
    const closePopup = () => {
        setPopupContext(null);
        setDqc1ApprovalChoice(null);
        setDesignUploadFiles([]);
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

    return (
        <div className='bg-blue-50 min-h-screen'>
            {/* --- HEADER SECTION --- */}
            {/* We hide the header if a card is maximized to give full focus */}
            {!activeCard && (
            <div className='xl:w-full xl:h-[23vh]'>
                <div className='xl:grid xl:grid-cols-5'>
                    <div className='xl:col-span-3 h-[23vh] mt-2 flex'>
                        <div>
                            <p className="w-[10vw] h-[4vh] xl:ml-2 xl:font-bold xl:pt-5 xl:pl-6 xl:text-green-900"><strong className='text-gray-400'>PID:</strong> {project.id}</p>
                            <p className="w-[20vw] h-[4vh] xl:ml-2 xl:font-bold xl:pt-5 xl:pl-6 xl:text-green-900"><strong className='text-gray-400'>Project Name:</strong> {project.projectName}</p>
                            <div className='xl:flex xl:gap-4 xl:mt-20 xl:ml-15'>
                                {['Overview', 'BOQ', 'Payment', 'Escalation'].map((tab) => (
                                    <div key={tab} className='xl:w-[10vw] xl:h-[4vh] xl:text-center xl:pt-1 xl:text-gray-400 xl:hover:border-b-2 xl:hover:text-green-900 xl:hover:bg-purple-50 xl:font-bold cursor-pointer'>{tab}</div>
                                ))}
                            </div>
                        </div>
                        <div className="xl:-ml-50 xl:w-[20vw] xl:pt-8 xl:pl-6 xl:h-[4vh] xl:text-green-900 xl:font-bold"><span className='text-gray-400'>Stages:</span> {project.projectStage}</div>
                    </div>

                    <div className='xl:col-span-2 xl:h-[23vh] xl:mt-2'>
                        <div className='xl:grid xl:grid-cols-4'>
                            <div className='xl:col-span-3 xl:ml-10'>
                                <div className='xl:w-[10vw] xl:h-[4vh] xl:border xl:border-gray-400 xl:text-center xl:pt-1 xl:mt-5 xl:font-bold xl:text-black xl:hover:text-green-900 xl:hover:bg-purple-50'>Prolance</div>
                                
                                {/* FIXED IMAGE STACKING LOGIC */}
                                <div className='xl:mt-15 xl:flex -space-x-4 items-center'>
                                    {image.map((imgdata) => (
                                        <div key={imgdata.id} className="relative z-0 hover:z-10 transition-all duration-200">
                                            <img src={imgdata.img} alt="profile" className='w-12 h-12 rounded-full border-2 border-white object-cover' />
                                        </div>
                                    ))}
                                    <button onClick={handleImageAdding} className='w-10 h-10 border border-black rounded-full text-center flex items-center justify-center bg-white ml-6 z-10 hover:bg-gray-100'>+</button>
                                </div>
                            </div>
                            <div className='xl:col-span-1 mt-8 space-y-4'>
                                <div className='w-[6vw] border border-gray-400 text-center py-2 font-bold xl:hover:text-green-900 xl:hover:bg-purple-50 cursor-pointer'>HOLD</div>
                                <div className='w-[6vw] border border-gray-400 text-center py-2 font-bold xl:hover:text-green-900 xl:hover:bg-purple-50 cursor-pointer'>RESUME</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* --- MAIN GRID --- */}
            <main className={`xl:grid xl:grid-cols-7 xl:gap-5 xl:m-4 transition-all duration-300 ${activeCard ? 'block' : ''}`}>
                
                {/* 1. MILESTONES CARD */}
                <div className={getCardClass('milestones', 'xl:col-span-3 xl:bg-white xl:h-[70vh] xl:text-center xl:font-bold xl:pt-8 xl:rounded-3xl text-gray-400 relative')}>
                    <h2 className='mb-10  '>{MileStonesArray.MilestonesName[selectedMilestoneIndex]?.name}</h2>
                    <button onClick={() => toggleMaximize('milestones')} className='absolute top-4 right-4 p-2  rounded hover:bg-gray-200'>
                        {activeCard === 'milestones' ? <img src="/maximize.png" className='w-[1.5vw]'></img> : <img src="/maximize.png" className='w-[1.5vw]'></img> }
                    </button>
                    {/* Change milestone: title, task list, and popup all use selectedMilestoneIndex */}
                    <select
                        value={selectedMilestoneIndex}
                        onChange={(e) => setSelectedMilestoneIndex(Number(e.target.value))}
                        className='xl:mb-4 text-sm border border-gray-300 rounded-md px-3 py-1.5 text-gray-700 font-normal'
                    >
                        {MileStonesArray.MilestonesName.map((m, i) => (
                            <option key={m.id} value={i}>{m.name}</option>
                        ))}
                    </select>
                    {/* milestone Creations*/}
                    <div className='xl:w-[60%] xl:h-[80%] xl:border-3 xl:border-solid xl:border-gray-300 xl:mx-auto xl:rounded-4xl '>
                        <div className='' >
                            {MileStonesArray.MilestonesName[selectedMilestoneIndex]?.taskList.map((task: string, taskIndex: Key) => {
                                const milestone = MileStonesArray.MilestonesName[selectedMilestoneIndex];
                                if (!milestone) return null;
                                return (
                                    <div key={taskIndex} className={`${milestone.Css}`}>
                                        <button onClick={() => openTaskPopup(selectedMilestoneIndex, task)} className='xl:w-full xl:h-full  xl:py-4 xl:px-4 '>{task}</button>
                                    </div>
                                );
                            })}
                        </div>

                    </div>

                   
                </div>

                {/* 2. HISTORY CARD */}
                <div className={getCardClass('history', 'xl:col-span-2 xl:bg-white xl:h-[70vh] xl:text-center xl:font-bold xl:pt-8 xl:rounded-3xl text-gray-400 relative')}>
                    <h2>History</h2>
                    <button onClick={() => toggleMaximize('history')} className='absolute top-4 right-4 p-2  rounded hover:bg-gray-200'>
                         {activeCard === 'history' ? <img src="/maximize.png" className='w-[1.5vw]'></img> : <img src="/maximize.png" className='w-[1.5vw]'></img>}
                    </button> 
                    <h1 className='xl:mt-55'>....... Under Construction .......</h1>
                    
                </div>

                {/* 3. RIGHT COLUMN (Contains Files & Chat) */}
                {/* Note: When maximizing Files or Chat, we hide this parent container's constraints logic effectively by using fixed on children */}
                <div className={`xl:col-span-2 xl:h-full xl:text-center xl:font-bold ${activeCard && activeCard !== 'files' && activeCard !== 'chat' ? 'hidden' : ''}`}>
                    <div className='xl:grid xl:grid-rows-2 xl:h-full xl:gap-4'>
                        
                        {/* FILES CARD */}
                        <div className={getCardClass('files', 'xl:rounded-3xl xl:bg-white xl:row-span-1 xl:text-center xl:font-bold xl:pt-8 text-gray-400 relative')}>
                            <h2>Files Uploaded</h2>
                            <button onClick={() => toggleMaximize('files')} className='absolute top-4 right-4 p-2  rounded hover:bg-gray-200'>
                                {activeCard === 'files' ? <img src="/maximize.png" className='w-[1.5vw]' ></img> : <img src="/maximize.png" className='w-[1.5vw]'></img>}
                            </button>
                            <h1 className='xl:mt-25'>....... Under Construction .......</h1>
                        </div>

                        {/* CHAT CARD */}
                        <div className={getCardClass('chat', 'xl:rounded-3xl xl:bg-white xl:row-span-1 xl:text-center xl:font-bold xl:pt-8 text-gray-400 relative')}>
                            <h2>ChatBox</h2>
                            <button onClick={() => toggleMaximize('chat')} className='absolute top-4 right-4 p-2  rounded hover:bg-gray-200'>
                                {activeCard === 'chat' ? <img src="/maximize.png " className='w-[1.5vw]'></img> : <img src="/maximize.png" className='w-[1.5vw]'></img>}
                            </button>
                            <h1 className='xl:mt-25'>....... Under Construction .......</h1>
                        </div>
                    </div>
                </div>

            </main>

            {/* Popup / Modal – section below by milestone index to add different popups */}
            {popupContext && (
                <>
                <div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/50' onClick={closePopup}>
                <div className='bg-white rounded-2xl shadow-2xl xl:max-h-[85vh] flex flex-col xl:w-[40vw] overflow-hidden' onClick={(e) => e.stopPropagation()}>
                <div className='flex justify-between items-center pt-6 px-6 pb-2 flex-shrink-0'>
                    <h3 className='text-lg font-bold text-gray-900'>{popupContext.milestoneIndex === 1 ? 'First Cut Design Discussion' : popupContext.milestoneName}</h3>
                    <button onClick={closePopup} className='text-gray-700 bg-gray-100 hover:text-gray-700 text-2xl leading-none border border-gray-300 rounded-md p-2 font-bold text-sm'>Close</button>
                </div>
                <div className='flex-1 overflow-y-auto min-h-0'>
                {/* ---------- Milestone 0: D1 SITE MEASUREMENT (your existing popup – do not change design) ---------- */}
                {popupContext.milestoneIndex === 0 && (
                <>
                <div className='flex items-center justify-between gap-2 px-6 py-2'>
                    <div>
                        <div className='font-bold text-sm'>Measurement Date</div>
                        <input type="date" className='w-[250px] border border-gray-300 rounded-md p-2 mt-2' />
                    </div>
                    <div>
                                <div className='font-bold text-sm'>Measurement Time</div>
                                <input type="time" className='w-[250px] border border-gray-300 rounded-md p-2 mt-2' />
                            </div>
                        </div>
                        <div className='text-[12px] text-gray-400 px-6 '>Select a future date only</div>
                        <div className='flex items-center gap-2 px-7 py-7'>
                            <div><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-gray-400 fill-gray-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                            </svg>
                            </div>
                            <div className='font-bold text-[12px] text-gray-500 pl-1 tracking-wide'>ASSIGNMENT</div>
                        </div>
                        <div>
                            <div className='font-bold text-sm px-6'>Measurement Executive</div>
                            <div className='w-[540px] h-[53px] border border-gray-300 rounded-md p-2 ml-6 mt-2 flex items-center justify-between'>
                                <div className='flex items-center gap-2 py-1.5 px-2'>
                                    <div className=''>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                    </svg>

                                    </div>
                                    <div>
                                        <div className='flex items-center gap-2 pl-2'><p className='bg-green-500 rounded-full w-[8px] h-[8px]'></p><p className='text-[14px] text-gray-600 font-bold'>Alex Johnson</p></div>
                                    </div>
                                </div>
                                <div className='flex items-center'>
                                    <div className='bg-green-50 rounded-md w-[150px] py-1.5 h-[32px] text-green-600 text-sm font-bold text-center'>Available Today</div>
                                    <div className='pl-2'>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                    </svg>
                                    </div>
                                </div>
                            </div>
                            {/* measurement Executive card */}
                            <div className='bg-gray-100 rounded-md w-[540px] h-[70px] p-2 ml-6 mt-10 flex items-center justify-between '>
                                <div className='pl-4'><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-gray-400 font-bold">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                                     </svg>
                                </div>
                                <div className='text-[12px] text-gray-500 italic p-2 pl-4'>The customer will be notified automatically via SMS and Email once the measurement request is submitted</div>
                            </div>
                            {/* Submit button */}
                            <div className='bg-gray-100 w-full h-[80px] rounded-b-2xl'>
                            <div className=' h-[1px] bg-gray-200 w-full mt-10'>
                            <button className='mt-5 ml-98 bg-blue-500 rounded-md w-[150px] py-1.5 h-[36px] text-white text-sm font-bold text-center items-end'>Submit Request</button>
                            </div>
                            </div>
                        </div>
                </>
                )}

                {/* ---------- Milestone 1: DQC1 – different popup per task ---------- */}
                {/* Task: First cut design + quotation discussion meeting request */}
                {popupContext.milestoneIndex === 1 && popupContext.taskName === 'First cut design + quotation discussion meeting request' && (
                    <div className='w-full min-h-[100vh]'>
                            <div>
                                <div className='w-full border border-gray-200 mt-2'></div>
                                <div className='flex items-center gap-2 py-4 px-6'>
                                    <div><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-blue-500">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                                    </svg>
                                    </div>
                                    <div className='text-[14px] font-bold text-black'>MEETING SCHEDULE</div>
                                </div>
                                {/* second section */}
                                <div>
                                <div className='flex items-center justify-between gap-2 px-6 py-2'>
                                <div>
                                    <div className='font-bold text-sm text-black placeholder-text-black'>Date</div>
                                    <input type="date" className='w-[250px] border border-gray-300 rounded-md p-2 mt-2' />
                                </div>
                                <div>
                                    <div className='font-bold text-sm text-black'>Time</div>
                                    <input type="time" className='w-[250px] border border-gray-300 rounded-md p-2 mt-2' />
                                </div>
                                </div>
                                </div>
                                {/* Third Section */}
                                <div>
                                <div className='flex items-center gap-2 py-4 px-6'>
                                    <div><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-blue-500">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                                            </svg>
                                    </div>
                                    <div className='text-[14px] font-bold text-black'>MEETING MODE</div>
                                </div>
                                </div>
                                <div className='flex  justify-around gap-4 bg-gray-200 w-47 h-12 rounded-md ml-5'>
                                <div className='text-blue-400 bg-white w-20 h-[4.5vh] text-center font-bold mt-1.5 pt-1.5 ml-1.5 rounded-md'>Online</div>
                                <div className='w-20 h-[4.5vh] text-center text-gray-400 font-bold mt-1.5 pt-1.5'>Offline</div>
                                </div>
                                {/* Fourth section */}
                                <div>
                                    <h1 className='pl-6 pt-4 font-semibold text-black'>Meeting Link</h1>
                                    <div className='relative w-138.75 mt-4 ml-4'>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 absolute left-3 top-3 text-gray-400">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                                    </svg>
                                        <input className='w-full h-12.5 border border-gray-300 rounded-xl placeholder-gray-500 font-medium text-[18px] pl-13' placeholder={`https://zoom.us/j/...`}></input>
                                    </div>
                                </div>
                                {/* fifth Section */}
                                <div>
                                <div className='flex items-center gap-2 py-4 px-6 mt-4'>
                                    <div><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 text-blue-400">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                                        </svg>

                                    </div>
                                    <div className='text-[14px] text-black font-bold'>DESIGN UPLOAD</div>
                                </div>
                                </div>
                                {/* Sixth Section – Design file upload */}
                                <div className="px-6 pb-6">
                                    <input
                                        ref={designFileInputRef}
                                        type="file"
                                        className="hidden"
                                        multiple
                                        onChange={onDesignFilesSelected}
                                    />
                                    <div
                                        className="w-full max-w-[540px] border-2 border-dashed border-gray-300 rounded-xl bg-white p-8 flex flex-col items-center justify-center min-h-[220px] cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                                        onClick={() => openDesignFileUpload('.pdf,.jpg,.jpeg,.png,.fig,.psd')}
                                        onDrop={onDesignDrop}
                                        onDragOver={onDesignDragOver}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && openDesignFileUpload('.pdf,.jpg,.jpeg,.png,.fig,.psd')}
                                    >
                                        <div className="w-14 h-14 rounded-full border-2 border-blue-200 bg-blue-50 flex items-center justify-center mb-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7 text-blue-600">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                                            </svg>
                                        </div>
                                        <p className="text-base font-semibold text-gray-800 mb-1">Click or drag design file to upload</p>
                                        <p className="text-sm text-gray-500 mb-6">Upload first design version for discussion</p>
                                        <div className="flex items-center justify-center gap-4 flex-wrap">
                                            <button type="button" onClick={(e) => { e.stopPropagation(); openDesignFileUpload('.pdf'); }} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-red-600 font-medium text-sm">
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                                                PDF
                                            </button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); openDesignFileUpload('.jpg,.jpeg,.png'); }} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-blue-600 font-medium text-sm">
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8.5" cy="8.5" r="1.5"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21"/></svg>
                                                JPG/PNG
                                            </button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); openDesignFileUpload('.fig,.psd'); }} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-purple-600 font-medium text-sm">
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3 3m-2.25-2.25a4.5 4.5 0 11-6.364 6.364 4.5 4.5 0 016.364-6.364zm-4.5 4.5l4.5 4.5"/></svg>
                                                FIG/PSD
                                            </button>
                                        </div>
                                    </div>
                                    {designUploadFiles.length > 0 && (
                                        <div className="mt-3 space-y-2 max-w-[540px]">
                                            <p className="text-sm font-medium text-gray-700">Selected files ({designUploadFiles.length})</p>
                                            {designUploadFiles.map((file, index) => (
                                                <div key={`${file.name}-${index}`} className="flex items-center justify-between text-sm bg-gray-100 rounded-lg px-3 py-2">
                                                    <span className="text-gray-700 truncate flex-1">{file.name}</span>
                                                    <button type="button" onClick={() => removeDesignFile(index)} className="text-red-600 hover:underline ml-2 flex-shrink-0">Remove</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className=' w-full border border-gray-200 mt-4'></div>
                                {/* Seventh Section */}
                                <div className='flex justify-between bg-gray-100'>
                                <div className='flex items-center gap-2 py-4 px-4 '>
                                       <div><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-black">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                                        </svg>
                                        </div>
                                       <div className='text-[13px] text-black w-75 '>Customer will receive calender invite automatically</div>
                                </div>
                                <div className='flex items-center justify-between gap-6 mr-5 py-6 '>
                                       <div className='text-[16px] text-gray-600'>Cancel</div>
                                       <button className='bg-blue-500 text-white w-35 h-9 rounded-md flex pl-3 pt-1.5 gap-2 font-bold'>Send Invite <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 ">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                                        </svg>
                                       </button>
                                </div>
                                </div>
                        </div>
                    </div>
                )}
                {/* Task: meeting completed */}
                {popupContext.milestoneIndex === 1 && popupContext.taskName === 'meeting completed' && (
                    <div className='px-6 pb-6'>
                        hi this is meeting completed
                    </div>
                )}
                {/* Task: Material selection meeting + quotation discussion */}
                {popupContext.milestoneIndex === 1 && popupContext.taskName === 'Material selection meeting + quotation discussion' && (
                    <div className='px-6 pb-6'>
                        {/* Add your popup content for "Material selection meeting + quotation discussion" here */}
                    </div>
                )}
                {/* Task: DQC 1 submission - dwg + quotation */}
                {popupContext.milestoneIndex === 1 && popupContext.taskName === 'DQC 1 submission - dwg + quotation' && (
                    <div className='px-6 pb-6'>
                        Hi from DQC 1 submission - dwg + quotation
                    </div>
                )}

                {/* ---------- Milestone 2: 10% PAYMENT – different popup per task ---------- */}
                {/* Task: 10% payment collection */}
                {popupContext.milestoneIndex === 2 && popupContext.taskName === '10% payment collection' && (
                    <div className='px-6 pb-6'>
                        {/* Add your popup content for "10% payment collection" here */}
                    </div>
                )}
                {/* Task: DQC 1 approval – different content for Approved vs Rejected */}
                {popupContext.milestoneIndex === 2 && popupContext.taskName === 'DQC 1 approval' && (
                    <div className='px-6 pb-6'>
                        {dqc1ApprovalChoice === null ? (
                            <div>
                                <p className='text-sm text-gray-600 mb-3'>Select outcome:</p>
                                <div className='flex gap-3'>
                                    <button type='button' onClick={() => setDqc1ApprovalChoice('approved')} className='px-4 py-2 rounded-md bg-green-100 text-green-800 font-medium hover:bg-green-200'>Approved</button>
                                    <button type='button' onClick={() => setDqc1ApprovalChoice('rejected')} className='px-4 py-2 rounded-md bg-red-100 text-red-800 font-medium hover:bg-red-200'>Rejected</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {dqc1ApprovalChoice === 'approved' && (
                                    <div>
                                        {/* Add your popup content for DQC 1 approval – APPROVED flow here */}
                                    </div>
                                )}
                                {dqc1ApprovalChoice === 'rejected' && (
                                    <div>
                                        {/* Add your popup content for DQC 1 approval – REJECTED flow here */}
                                    </div>
                                )}
                                <button type='button' onClick={() => setDqc1ApprovalChoice(null)} className='mt-3 text-sm text-gray-500 underline'>Change selection</button>
                            </>
                        )}
                    </div>
                )}

                {/* ---------- Milestone 3: D2 SITE MASKING – add your popup content below ---------- */}
                {popupContext.milestoneIndex === 3 && (
                    <div className='px-6 pb-6'>
                        {/* Add your popup content for D2 SITE MASKING here */}
                    </div>
                )}

                {/* ---------- Milestone 4: DQC2 – add your popup content below ---------- */}
                {popupContext.milestoneIndex === 4 && (
                    <div className='px-6 pb-6'>
                        {/* Add your popup content for DQC2 here */}
                    </div>
                )}

                {/* ---------- Milestone 5: 40% PAYMENT – add your popup content below ---------- */}
                {popupContext.milestoneIndex === 5 && (
                    <div className='px-6 pb-6'>
                        {/* Add your popup content for 40% PAYMENT here */}
                    </div>
                )}

                {/* ---------- Milestone 6: PUSH TO PRODUCTION – add your popup content below ---------- */}
                {popupContext.milestoneIndex === 6 && (
                    <div className='px-6 pb-6'>
                        {/* Add your popup content for PUSH TO PRODUCTION here */}
                    </div>
                )}

                </div>
                </div>
                </div>
                </>
            )}
        </div>
    );
}