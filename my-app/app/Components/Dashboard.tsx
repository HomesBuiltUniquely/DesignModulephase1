'use client';
import { useState } from "react";
import { SideDashboard } from "../Enums/Enums";

export default function Dashboard() {
    
    const allTypes = Object.values(SideDashboard);


    return (
        <div>
            <main className="">
                <div className="xl:grid xl:grid-cols-5 xl:gap-4">
                    <div className=" xl:grid-cols-1 xl:h-screen border-r border-gray-300 xl:pt-4 xl:pl-2">

                    <div className="xl:flex xl:justify-between xl:items-center mb-2 xl:pr-2 xl:py-4">
                    <div className="xl:text-lg xl:font-semibold s xl:pl-2 xl:pt-4">My WorkSpace</div>
                    <div><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-7 pt-3 font-bold xl:cursor-pointer">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                    </div>
                    </div>
                    {allTypes.map((type) => (
                        <option value={type} className="xl:p-4 xl:border-gray-300 hover:xl:border-l-3 hover:xl:border-l-[#c3c0db] xl:cursor-pointer hover:xl:bg-gray-100 hover:xl:text-[#c3c0db]  xl:font-semibold hover:xl:font-bold xl:inline-block xl:w-full text-left hover:xl:scale-105 xl:transition-transform xl:duration-200">
                            {type}
                        </option>
                    ))}   
                    </div>
                    <div className="xl:grid-cols-4 ">
                        
                    </div>
                </div>
            </main>
        </div>
    );
    }