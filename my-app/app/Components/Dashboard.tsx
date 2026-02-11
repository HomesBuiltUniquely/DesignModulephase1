'use client';

import { useState } from "react";
import { SideDashboard } from "../Enums/Enums";
import { useRouter } from "next/navigation";
import { LeadshipTypes } from "./Types/Types";


export default function Dashboard() {

    const arr: LeadshipTypes[] = [
    {id:1, Projectname:"Project A", stage:"Initiation", createdAt:"2023-01-01", updatedAt:"2023-01-02"},
    {id:2, Projectname:"Project B", stage:"Planning", createdAt:"2023-02-01", updatedAt:"2023-02-02"},
    {id:3, Projectname:"Project C", stage:"Execution", createdAt:"2023-03-01", updatedAt:"2023-03-02"},
    {id:4, Projectname:"Project D", stage:"Execution", createdAt:"2023-03-01", updatedAt:"2023-03-02"},
    {id:5, Projectname:"Project E", stage:"Execution", createdAt:"2023-03-01", updatedAt:"2023-03-02"},
    {id:6, Projectname:"Project F", stage:"Execution", createdAt:"2023-03-01", updatedAt:"2023-03-02"}
 ];
    
    const allTypes = Object.values(SideDashboard);
    const [isDropdownOpen, setIsDropdownOpen] = useState(true);
    const [isSelected, setIsSelected] = useState("All Prjects");

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
                            {arr.map((arr1) => {
                                return (
                                    <div key={arr1.id} className={`xl:flex xl:justify-between xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-100 xl:cursor-pointer ${(arr1.id % 2 === 0) ? 'bg-gray-50' : 'bg-gray-100'}`} onClick={() => handleRouter(arr1.id)}> 
                                        <div className={`xl:text-lg xl:font-semibold`} >
                                            {arr1.id}
                                        </div>
                                        <div className="xl:text-lg xl:font-semibold">{arr1.Projectname}</div>
                                        <div className="xl:text-sm xl:text-gray-500">Stage: {arr1.stage}</div>
                                        <div className="xl:text-sm xl:text-gray-500">Created At: {arr1.createdAt}</div>
                                        <div className="xl:text-sm xl:text-gray-500">Updated At: {arr1.updatedAt}</div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                case "Pre 10%":
                    return <div className="">{arr.map((arr1) => {
                        return (
                            <div key={arr1.id} className="xl:flex xl:justify-between xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-100 xl:cursor-pointer" onClick={() => handleRouter(arr1.id)}> 
                               <div className="xl:text-lg xl:font-semibold">{arr1.id}</div>
                                <div className="xl:text-lg xl:font-semibold">{arr1.Projectname}</div>
                                <div className="xl:text-sm xl:text-gray-500">Stage: {arr1.stage}</div>
                                <div className="xl:text-sm xl:text-gray-500">Created At: {arr1.createdAt}</div>
                                <div className="xl:text-sm xl:text-gray-500">Updated At: {arr1.updatedAt}</div>                            </div>
                        );
                    })}</div>;
                case "10-20%":
                    return <div className="">{arr.map((arr1) => {
                        return (
                            <div key={arr1.id} className="xl:flex xl:justify-between xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-100 xl:cursor-pointer" onClick={() => handleRouter(arr1.id)}> 
                                <div className="xl:text-lg xl:font-semibold">{arr1.id}</div>
                                <div className="xl:text-lg xl:font-semibold">{arr1.Projectname}</div>
                                <div className="xl:text-sm xl:text-gray-500">Stage: {arr1.stage}</div>
                                <div className="xl:text-sm xl:text-gray-500">Created At: {arr1.createdAt}</div>
                                <div className="xl:text-sm xl:text-gray-500">Updated At: {arr1.updatedAt}</div>                            </div>
                        );
                    })}</div>;
                case "20-60%":
                    return <div className="">{arr.map((arr1) => {
                        return (
                            <div key={arr1.id} className="xl:flex xl:justify-between xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-100 xl:cursor-pointer" onClick={() => handleRouter(arr1.id)}> 
                                <div className="xl:text-lg xl:font-semibold">{arr1.id}</div>
                                <div className="xl:text-lg xl:font-semibold">{arr1.Projectname}</div>
                                <div className="xl:text-sm xl:text-gray-500">Stage: {arr1.stage}</div>
                                <div className="xl:text-sm xl:text-gray-500">Created At: {arr1.createdAt}</div>
                                <div className="xl:text-sm xl:text-gray-500">Updated At: {arr1.updatedAt}</div>                            </div>
                        );
                    })}</div>;
                default:
                    return <div className="">{arr.map((arr1) => {
                        return (
                            <div key={arr1.id} className="xl:flex xl:justify-between xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-50 xl:cursor-pointer" onClick={() => handleRouter(arr1.id)}> 
                                <div className="xl:text-lg xl:font-semibold">{arr1.id}</div>
                                <div className="xl:text-lg xl:font-semibold">{arr1.Projectname}</div>
                                <div className="xl:text-sm xl:text-gray-500">Stage: {arr1.stage}</div>
                                <div className="xl:text-sm xl:text-gray-500">Created At: {arr1.createdAt}</div>
                                <div className="xl:text-sm xl:text-gray-500">Updated At: {arr1.updatedAt}</div>                            </div>
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
                        <div className="xl:flex xl:justify-between xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md">
                            <div className="">ID</div>
                            <div className="">Project Name</div>
                            <div className="pr-16">Stage</div>
                            <div className="pr-16">Created At:</div>
                            <div className="pr-16">Updated At:</div>
                        </div>
    
                        {renderContent()}
                    </div>
                </div>
            </main>
        </div>
    );
    }