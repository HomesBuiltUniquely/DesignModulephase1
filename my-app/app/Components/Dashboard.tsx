'use client';

import { SideDashboard } from "../Enums/Enums";
import { useRouter } from "next/navigation";
import { LeadshipTypes } from "./Types/Types";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

// Stage column: only Active or Inactive (status)
function getStatusDisplay(stage: string): "Active" | "Inactive" {
    if (!stage) return "Active";
    const s = stage.trim();
    if (s === "Inactive") return "Inactive";
    return "Active";
}

// Progress column: Pre 10%, 10-20%, or 20-60%
function getStageBucket(stage: string): string {
    if (!stage) return "Pre 10%";
    const s = stage.trim();
    if (s === "Inactive") return "Pre 10%";
    if (s === "Active") return "10-20%";
    if (s === "10-20%") return "10-20%";
    if (s === "20-60%" || s === "20" || s === "20-60") return "20-60%";
    if (["SUBMITTED", "PAYMENT_PENDING", "D1_ACTIVATED", "CONDITIONAL_D1", "Pre 10%"].includes(s)) return "Pre 10%";
    if (s.startsWith("10") && s.includes("20")) return "10-20%";
    if (s.startsWith("20") || s.includes("60")) return "20-60%";
    return "Pre 10%";
}

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

const API = "http://localhost:3001";

export default function Dashboard() {
    const { user, sessionId } = useAuth();
    const [projects, setProjects] = useState<LeadshipTypes[]>([]);
    const [uploadingId, setUploadingId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const targetLeadRef = useRef<number | null>(null);

    const isMmtUser = ["mmt_manager", "mmt_executive"].includes((user?.role || "").toLowerCase());

    // Fetch leads queue (includes seed data + new leads from sales closure form)
    useEffect(() => {
        const headers: Record<string, string> = {};
        if (sessionId) headers["Authorization"] = `Bearer ${sessionId}`;
        fetch(`${API}/api/leads/queue`, { headers })
            .then((res) => res.text().then((t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } }))
            .then((data) => {
                if (Array.isArray(data)) {
                    setProjects(data);
                }
            })
            .catch((err) => {
                console.error("Error fetching leads queue:", err);
            });
    }, [sessionId]);

    const onUploadClick = (e: React.MouseEvent, leadId: number) => {
        e.stopPropagation();
        targetLeadRef.current = leadId;
        fileInputRef.current?.click();
    };

    const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        const leadId = targetLeadRef.current;
        if (!file || !leadId || !sessionId) return;
        setUploadingId(leadId);
        try {
            const fd = new FormData();
            fd.append("zip", file);
            const res = await fetch(`${API}/api/leads/${leadId}/uploads`, {
                method: "POST",
                headers: { Authorization: `Bearer ${sessionId}` },
                body: fd,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Upload failed");
        } catch (err) {
            console.error("Upload error", err);
        } finally {
            setUploadingId(null);
            targetLeadRef.current = null;
        }
    };

    const allTypes = Object.values(SideDashboard);
    const [isDropdownOpen, setIsDropdownOpen] = useState(true);
    const [isSelected, setIsSelected] = useState<string>(allTypes[0]); // "All Projects (10-60%)"

    const filteredProjects = isSelected === "All Projects (10-60%)"
        ? projects.filter((p) => {
            const bucket = getStageBucket(p.projectStage);
            return bucket === "10-20%" || bucket === "20-60%";
          })
        : projects.filter((p) => getStageBucket(p.projectStage) === isSelected);

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
        const list = filteredProjects;
        if (isMmtUser) {
            return (
                <div>
                    {list.map((arr1) => (
                        <div
                            key={arr1.id}
                            className={`xl:grid xl:grid-cols-4 xl:gap-4 xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-100 xl:text-gray-900 xl:cursor-pointer xl:items-center ${(arr1.id % 2 === 0) ? "bg-gray-50" : "bg-gray-100"}`}
                            onClick={() => handleRouter(arr1.id)}
                        >
                            <div className="xl:text-lg xl:font-semibold xl:text-center">{arr1.id}</div>
                            <div className="xl:text-lg xl:font-semibold xl:text-left">{arr1.projectName}</div>
                            <div className="xl:text-lg xl:font-semibold xl:text-center">{getStatusDisplay(arr1.projectStage)}</div>
                            <div className="xl:text-center" onClick={(e) => onUploadClick(e, arr1.id)}>
                                <button
                                    type="button"
                                    disabled={uploadingId === arr1.id}
                                    className="xl:px-4 xl:py-2 xl:rounded-lg xl:bg-green-600 xl:text-white xl:font-semibold xl:text-sm hover:xl:bg-green-700 disabled:xl:opacity-60"
                                >
                                    {uploadingId === arr1.id ? "Uploading…" : "Upload ZIP"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
        return (
            <div>
                {list.map((arr1) => (
                    <div
                        key={arr1.id}
                        className={`xl:grid xl:grid-cols-6 xl:gap-4 xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-100 xl:text-gray-900 hover:xl:text-gray-900 xl:cursor-pointer xl:items-center ${(arr1.id % 2 === 0) ? "bg-gray-50" : "bg-gray-100"}`}
                        onClick={() => handleRouter(arr1.id)}
                    >
                        <div className="xl:text-lg xl:font-semibold xl:text-center">{arr1.id}</div>
                        <div className="xl:text-lg xl:font-semibold xl:text-left">{arr1.projectName}</div>
                        <div className="xl:text-lg xl:font-semibold xl:text-center">{getStatusDisplay(arr1.projectStage)}</div>
                        <div className="xl:text-lg xl:font-semibold xl:text-center">{getStageBucket(arr1.projectStage)}</div>
                        <div className="xl:text-lg xl:font-semibold xl:text-left xl:whitespace-nowrap">{formatDateTime(arr1.createAt)}</div>
                        <div className="xl:text-lg xl:font-semibold xl:text-left xl:whitespace-nowrap">{formatDateTime(arr1.updateAt)}</div>
                    </div>
                ))}
            </div>
        );
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
                        <div className={`xl:grid xl:gap-4 xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md xl:bg-black xl:text-white xl:text-lg xl:font-bold xl:items-center ${isMmtUser ? "xl:grid-cols-4" : "xl:grid-cols-6"}`}>
                            <div className="xl:text-center">ID</div>
                            <div className="xl:text-left">Project Name</div>
                            <div className="xl:text-center">Stage</div>
                            {!isMmtUser && (
                                <>
                                    <div className="xl:text-center">Progress</div>
                                    <div className="xl:text-left">Created At</div>
                                    <div className="xl:text-left">Updated At</div>
                                </>
                            )}
                            {isMmtUser && <div className="xl:text-center">Upload</div>}
                        </div>

                        {renderContent()}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".zip,application/zip,.dwg"
                            className="hidden"
                            onChange={onFileSelected}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}