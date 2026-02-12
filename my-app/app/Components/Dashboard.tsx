'use client';

import { SideDashboard } from "../Enums/Enums";
import { useRouter } from "next/navigation";
import { LeadshipTypes } from "./Types/Types";
import { useEffect, useState } from "react";

// Helper to format backend date strings (ISO) to "dd/MM/yyyy h:mm A"
function formatDateTime(value: string): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value; // fallback if parsing fails

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;

    return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}

export default function Dashboard() {

    const [projects, setProjects] = useState<LeadshipTypes[]>([]);

    useEffect(() => {
        fetch("http://localhost:8080/api/v1/projects/all")
        .then((res) => res.json())
        .then((json) => {
            setProjects(json.data ?? []);
        })
        .catch((err) => {
            console.error("Error fetching projects:", err);
        });
    }, []);
    
    
    const allTypes = Object.values(SideDashboard);
    const [isDropdownOpen, setIsDropdownOpen] = useState(true);
    const [isSelected, setIsSelected] = useState("All Projects");

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleSelection = (type: string) => {
        setIsSelected(type);
    }

    const router = useRouter();

    const handleRouter = (projectId: number) => {
        router.push(`/Leads/${projectId}`);
    }

    const renderContent = () => {
            switch(isSelected){
                case "All Projects":
                    return (
                        <div>
                            {projects.map((arr1) => {
                                return (
                                    <div key={arr1.id} className={`xl:flex xl:justify-between xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-100 xl:text-gray-900 hover:xl:text-gray-900 xl:cursor-pointer ${(arr1.id % 2 === 0) ? 'bg-gray-50' : 'bg-gray-100'}`} onClick={() => handleRouter(arr1.id)}> 
                                        <div className={`xl:text-lg xl:font-semibold`} >
                                            {arr1.id}
                                        </div>
                                        <div className="xl:text-lg xl:font-semibold">{arr1.projectName}</div>
                                        <div className="xl:text-lg xl:font-semibold">{arr1.projectStage}</div>
                                        <div className="xl:text-lg xl:font-semibold">{formatDateTime(arr1.createAt)}</div>
                                        <div className="xl:text-lg xl:font-semibold">{formatDateTime(arr1.updateAt)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                case "Pre 10%":
                    return <div className="">{projects.map((arr1) => {
                        return (
                            <div key={arr1.id} className="xl:flex xl:justify-between xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-100 xl:text-gray-900 hover:xl:text-gray-900 xl:cursor-pointer" onClick={() => handleRouter(arr1.id)}> 
                            <div className="xl:text-lg xl:font-semibold">{arr1.id}</div>
                            <div className="xl:text-lg xl:font-semibold">{arr1.projectName}</div>
                                <div className="xl:text-lg xl:font-semibold">{arr1.projectStage}</div>
                                <div className="xl:text-lg xl:font-semibold">{formatDateTime(arr1.createAt)}</div>
                                <div className="xl:text-lg xl:font-semibold">{formatDateTime(arr1.updateAt)}</div>                            </div>
                        );
                    })}</div>;
                case "10-20%":
                    return <div className="">{projects.map((arr1) => {
                        return (
                            <div key={arr1.id} className="xl:flex xl:justify-between xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-100 xl:text-gray-900 hover:xl:text-gray-900 xl:cursor-pointer" onClick={() => handleRouter(arr1.id)}> 
                                <div className="xl:text-lg xl:font-semibold">{arr1.id}</div>
                                <div className="xl:text-lg xl:font-semibold">{arr1.projectName}</div>
                                <div className="xl:text-lg xl:font-semibold">{arr1.projectStage}</div>
                                <div className="xl:text-lg xl:font-semibold">{formatDateTime(arr1.createAt)}</div>
                                <div className="xl:text-lg xl:font-semibold">{formatDateTime(arr1.updateAt)}</div>                            </div>
                        );
                    })}</div>;
                case "20-60%":
                    return <div className="">{projects.map((arr1) => {
                        return (
                            <div key={arr1.id} className="xl:flex xl:justify-between xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-100 xl:text-gray-900 hover:xl:text-gray-900 xl:cursor-pointer" onClick={() => handleRouter(arr1.id)}> 
                                <div className="xl:text-lg xl:font-semibold">{arr1.id}</div>
                                <div className="xl:text-lg xl:font-semibold">{arr1.projectName}</div>
                                <div className="xl:text-lg xl:font-semibold">{arr1.projectStage}</div>
                                <div className="xl:text-lg xl:font-semibold">{formatDateTime(arr1.createAt)}</div>
                                <div className="xl:text-lg xl:font-semibold">{formatDateTime(arr1.updateAt)}</div>                            </div>
                        );
                    })}</div>;
                default:
                    return <div className="">{projects.map((arr1) => {
                        return (
                            <div key={arr1.id} className="xl:flex xl:justify-between xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-50 xl:text-gray-900 hover:xl:text-gray-900 xl:cursor-pointer" onClick={() => handleRouter(arr1.id)}> 
                                <div className="xl:text-lg xl:font-semibold">{arr1.id}</div>
                                <div className="xl:text-lg xl:font-semibold">{arr1.projectName}</div>
                                <div className="xl:text-lg xl:font-semibold">{arr1.projectStage}</div>
                                <div className="xl:text-lg xl:font-semibold">{formatDateTime(arr1.createAt)}</div>
                                <div className="xl:text-lg xl:font-semibold">{formatDateTime(arr1.updateAt)}</div>                            </div>
                        );
                    })}</div>;
            }
    }

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
                                    onClick={() => handleSelection(type)}
                                    className={`xl:p-4 xl:border-gray-300 xl:cursor-pointer xl:font-semibold xl:inline-block xl:w-66.25 text-left xl:transition-all xl:duration-200 ${
                                        isSelected === type 
                                            ? 'xl:border-l-4 xl:border-l-green-400 xl:bg-gray-100 xl:text-green-400 xl:font-bold' 
                                            : 'hover:xl:xl:border-l-4 hover:xl:border-l-green-400 hover:xl:bg-gray-100 hover:xl:text-green-400 hover:xl:font-bold hover:xl:scale-105'
                                    }`}
                                >
                                    {type}
                                </div>
                            ))}
                        </div>
                    )}   
                    </div>
                    <div className="xl:grid-cols-4 ">
                        <div className="xl:flex xl:justify-between xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md xl:bg-black xl:text-white xl:text-lg xl:font-bold">
                            <div className="">ID</div>
                            <div className="">Project Name</div>
                            <div className="pr-16">Stage</div>
                            <div className="pr-16">Created At</div>
                            <div className="pr-16">Updated At</div>
                        </div>
    
                        {renderContent()}
                    </div>
                </div>
            </main>
        </div>
    );
    }