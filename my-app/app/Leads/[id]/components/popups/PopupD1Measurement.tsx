'use client';

import { useState, useEffect } from 'react';

const API = 'http://localhost:3001';

type MmtExecutive = { id: number; name: string; email: string };

type Props = {
    leadId: number | null;
    sessionId: string | null;
    onSubmit?: () => void;
};

/**
 * D1 Site Measurement popup – measurement date/time, assignment (Measurement Executive dropdown), submit.
 * On submit, creates a D1 assignment so only that MMT executive will see this lead.
 */
export default function PopupD1Measurement({ leadId, sessionId, onSubmit }: Props) {
    const [executives, setExecutives] = useState<MmtExecutive[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [measurementDate, setMeasurementDate] = useState<string>('');
    const [measurementTime, setMeasurementTime] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!sessionId) {
            setLoaded(true);
            return;
        }
        fetch(`${API}/api/auth/mmt-executives`, { headers: { Authorization: `Bearer ${sessionId}` } })
            .then(async (res) => {
                const text = await res.text();
                if (!res.ok || !text) return [];
                try { const d = JSON.parse(text); return Array.isArray(d) ? d : []; } catch { return []; }
            })
            .then((data) => {
                const list = Array.isArray(data) ? data : [];
                setExecutives(list);
                if (list.length > 0) setSelectedId(String(list[0].id));
                setLoaded(true);
            })
            .catch(() => setLoaded(true));
    }, [sessionId]);

    const selected = executives.find((e) => String(e.id) === selectedId);

    return (
        <>
            <div className="flex items-center justify-between gap-2 px-6 py-2">
                <div>
                    <div className="font-bold text-sm">Measurement Date</div>
                    <input type="date" className="w-[250px] border border-gray-300 rounded-md p-2 mt-2" value={measurementDate} onChange={(e) => setMeasurementDate(e.target.value)} />
                </div>
                <div>
                    <div className="font-bold text-sm">Measurement Time</div>
                    <input type="time" className="w-[250px] border border-gray-300 rounded-md p-2 mt-2" value={measurementTime} onChange={(e) => setMeasurementTime(e.target.value)} />
                </div>
            </div>
            <div className="text-[12px] text-gray-400 px-6">Select a future date only</div>
            <div className="flex items-center gap-2 px-7 py-7">
                <div>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-gray-400 fill-gray-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                    </svg>
                </div>
                <div className="font-bold text-[12px] text-gray-500 pl-1 tracking-wide">ASSIGNMENT</div>
            </div>
            <div>
                <div className="font-bold text-sm px-6">Measurement Executive</div>
                <div className="w-full max-w-[540px] border border-gray-300 rounded-md p-2 ml-6 mt-2 flex items-center justify-between min-h-[53px]">
                    <div className="flex items-center gap-2 py-1.5 px-2 flex-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4 text-gray-400 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        <select
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                            className="flex-1 min-w-0 text-[14px] text-gray-600 font-bold bg-transparent border-none focus:ring-0 focus:outline-none cursor-pointer"
                        >
                            <option value="">Select Measurement Executive</option>
                            {executives.map((ex) => (
                                <option key={ex.id} value={ex.id}>
                                    {ex.name}
                                </option>
                            ))}
                        </select>
                        {selected && (
                            <span className="bg-green-500 rounded-full w-[8px] h-[8px] shrink-0" title="Selected" />
                        )}
                    </div>
                    <div className="flex items-center shrink-0">
                        <div className="bg-green-50 rounded-md px-3 py-1.5 h-[32px] text-green-600 text-sm font-bold text-center flex items-center">
                            {loaded && executives.length === 0 ? 'None available' : 'Available'}
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4 ml-2 text-gray-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                    </div>
                </div>
                {loaded && executives.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1 px-6">No MMT executives in the system. Add them via MMT Manager → Register MMT Executive.</p>
                )}
                <div className="bg-gray-100 rounded-md w-[540px] h-[70px] p-2 ml-6 mt-10 flex items-center justify-between">
                    <div className="pl-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-gray-400 font-bold">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                        </svg>
                    </div>
                    <div className="text-[12px] text-gray-500 italic p-2 pl-4">The customer will be notified automatically via SMS and Email once the measurement request is submitted</div>
                </div>
                {submitError && <p className="text-sm text-red-600 px-6 mt-2">{submitError}</p>}
                <div className="bg-gray-100 w-full h-[80px] rounded-b-2xl">
                    <div className="h-[1px] bg-gray-200 w-full mt-10" />
                    <button type="button" onClick={handleSubmit} disabled={submitting || !selectedId} className="mt-5 ml-98 bg-blue-500 rounded-md w-[150px] py-1.5 h-[36px] text-white text-sm font-bold text-center items-end disabled:opacity-60">
                        {submitting ? 'Submitting…' : 'Submit Request'}
                    </button>
                </div>
            </div>
        </>
    );
}
