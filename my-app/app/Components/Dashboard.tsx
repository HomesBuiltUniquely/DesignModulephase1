'use client';
import { useState } from "react";
import { SideDashboard } from "../Enums/Enums";

export default function Dashboard() {
    
    const allTypes = Object.values(SideDashboard);
    const [isDropdownOpen, setIsDropdownOpen] = useState(true);

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    return (
        <div>
            <main className="">
                <div className="xl:grid xl:grid-cols-5 xl:gap-4">
                    <div className=" xl:grid-cols-1 xl:h-screen border-r border-gray-300 xl:pt-4 xl:pl-2">

                    <div 
                        className="xl:flex xl:justify-between xl:items-center mb-2 xl:pr-2 xl:py-4 xl:cursor-pointer"
                        onClick={toggleDropdown}
                    >
                    <div className="xl:text-lg xl:font-semibold s xl:pl-2 xl:pt-4">My WorkSpace</div>
                    <div>
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            strokeWidth="1.5" 
                            stroke="currentColor" 
                            className={`size-5 mt-4 font-bold xl:cursor-pointer transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                    </div>
                    </div>
                    {isDropdownOpen && (
                        <div className="xl:transition-all xl:duration-200">
                            {allTypes.map((type, index) => (
                                <div 
                                    key={index}
                                    className="xl:p-4  xl:border-gray-300 hover:xl:border-l-3 hover:xl:border-l-green-400 xl:cursor-pointer hover:xl:bg-gray-100 hover:xl:text-green-400 xl:font-semibold hover:xl:font-bold xl:inline-block xl:w-[265px] text-left hover:xl:scale-105 xl:transition-transform xl:duration-200"
                                >
                                    {type}
                                </div>
                            ))}
                        </div>
                    )}   
                    </div>
                    <div className="xl:grid-cols-4 ">
                        
                    </div>
                </div>
            </main>
        </div>
    );
    }