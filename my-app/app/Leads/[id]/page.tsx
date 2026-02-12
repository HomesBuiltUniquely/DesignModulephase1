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

    // Sample data (matches LeadshipTypes: projectName, projectStage, createAt, updateAt)
    const projects: LeadshipTypes[] = [
        {id:1, pid:"", projectName:"Bharath D", projectStage:"Active", createAt:"2023-01-01", updateAt:"2023-01-02"},
        {id:2, pid:"", projectName:"Shivram", projectStage:"Active", createAt:"2023-02-01", updateAt:"2023-02-02"},
        {id:3, pid:"", projectName:"Gokul", projectStage:"Ina", createAt:"2023-03-01", updateAt:"2023-03-02"}
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
                                    if (index === 0) {
                                        return milestone.taskList.map((task: string, taskIndex: Key) => (
                                            <div key={taskIndex} className = {`${milestone.Css}`}>
                                                <div className='xl:w-full xl:h-full  xl:py-4 xl:px-4 '>{task}</div>
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
                        </div>

                        {/* CHAT CARD */}
                        <div className={getCardClass('chat', 'xl:rounded-3xl xl:bg-white xl:row-span-1 xl:text-center xl:font-bold xl:pt-8 text-gray-400 relative')}>
                            <h2>ChatBox</h2>
                            <button onClick={() => toggleMaximize('chat')} className='absolute top-4 right-4 p-2  rounded hover:bg-gray-200'>
                                {activeCard === 'chat' ? <img src="/maximize.png " className='w-[1.5vw]'></img> : <img src="/maximize.png" className='w-[1.5vw]'></img>}
                            </button>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}