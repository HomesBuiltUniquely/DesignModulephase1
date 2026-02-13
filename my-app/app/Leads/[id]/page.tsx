'use client';

import { useParams, useRouter } from 'next/navigation';
import { Key, useState } from 'react';
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
    const [showPopup, setShowPopup] = useState(false);

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

    const handleClick = () => setShowPopup(true);
    const closePopup = () => setShowPopup(false);

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
                    <h2 className='mb-10  '>{MileStonesArray.MilestonesName.map((milestone,index)=>(index===0 && (milestone.name)))}</h2>
                    <button onClick={() => toggleMaximize('milestones')} className='absolute top-4 right-4 p-2  rounded hover:bg-gray-200'>
                        {activeCard === 'milestones' ? <img src="/maximize.png" className='w-[1.5vw]'></img> : <img src="/maximize.png" className='w-[1.5vw]'></img> }
                    </button>
                    {/* milestone Creations*/}
                    <div className='xl:w-[60%] xl:h-[80%] xl:border-3 xl:border-solid xl:border-gray-300 xl:mx-auto xl:rounded-4xl '>
                        <div className='' >
                            {
                                MileStonesArray.MilestonesName.map((milestone, index) => {
                                    if (index === 1) {
                                        return milestone.taskList.map((task: string, taskIndex: Key) => (
                                            <div key={taskIndex} className = {`${milestone.Css}`}>
                                                <button onClick={handleClick} className='xl:w-full xl:h-full  xl:py-4 xl:px-4 '>{task}</button>
                                            </div>
                                        ));
                                    }
                                    return null;
                                })
                            }
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

            {/* Popup / Modal */}
            {showPopup && (
                <>
                <div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/50' onClick={closePopup}>
                <div className='bg-white rounded-2xl shadow-2xl xl:max-h-[80vh] flex flex-col xl:w-[40vw] overflow-hidden' onClick={(e) => e.stopPropagation()}>
                <div className='flex justify-between items-center mb-4 pt-6 px-6'>
                    <h3 className='text-lg font-bold text-gray-900'>{MileStonesArray.MilestonesName[2]?.name}</h3>
                    <button onClick={closePopup} className='text-gray-700 bg-gray-100 hover:text-gray-700 text-2xl leading-none border border-gray-300 rounded-md p-2 font-bold text-sm mb-6'>Close</button>
                </div>
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
                </div>
                </div>
                </>
            )}
        </div>
    );
}