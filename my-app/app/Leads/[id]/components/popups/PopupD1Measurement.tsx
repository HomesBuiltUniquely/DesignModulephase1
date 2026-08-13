'use client';

import { useState, useEffect } from 'react';

import { getApiBase } from '@/app/lib/apiBase';
import CustomDatePicker from '@/app/Components/ui/CustomDatePicker';
import CustomTimePicker from '@/app/Components/ui/CustomTimePicker';
import CustomSelect from '@/app/Components/ui/CustomSelect';
const API = getApiBase();

type MmtManager = { id: number; name: string; email: string };

type Props = {
    leadId: number | null;
    sessionId: string | null;
    /** Called after request + internal mail succeed (auto mark task done) */
    onSubmit?: () => void | Promise<unknown>;
    onClose?: () => void;
};

/**
 * D1 Site Measurement – designer picks date/time + MMT manager.
 * Submit sends internal mail to manager; external visit mail waits until manager assigns executive.
 */
export default function PopupD1Measurement({ leadId, sessionId, onSubmit, onClose }: Props) {
    const [managers, setManagers] = useState<MmtManager[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [measurementDate, setMeasurementDate] = useState<string>('');
    const [measurementTime, setMeasurementTime] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!sessionId) {
            setLoaded(true);
            return;
        }
        fetch(`${API}/api/auth/mmt-managers`, { headers: { Authorization: `Bearer ${sessionId}` } })
            .then(async (res) => {
                const text = await res.text();
                if (!res.ok || !text) return [];
                try { const d = JSON.parse(text); return Array.isArray(d) ? d : []; } catch { return []; }
            })
            .then((data) => {
                const list = Array.isArray(data) ? data : [];
                setManagers(list);
                if (list.length > 0) setSelectedId(String(list[0].id));
                setLoaded(true);
            })
            .catch(() => setLoaded(true));
    }, [sessionId]);

    const selected = managers.find((m) => String(m.id) === selectedId);

    async function handleSubmit() {
        if (!leadId || !sessionId || !selectedId) return;
        setSubmitError(null);
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/d1-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionId}` },
                body: JSON.stringify({
                    mmtManagerId: Number(selectedId),
                    measurementDate: measurementDate || null,
                    measurementTime: measurementTime || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data.message || 'Failed to submit D1 request';
                setSubmitError(msg);
                setToast(msg);
                setTimeout(() => setToast(null), 3000);
                console.error('[D1-MMT] Submit failed', { status: res.status, data });
                return;
            }
            if (!data.mailSent) {
                const msg = data.message || 'Request saved but manager email failed.';
                setSubmitError(msg);
                setToast(msg);
                setTimeout(() => setToast(null), 3000);
                return;
            }
            setToast('Request submitted successfully!');
            await onSubmit?.();
            setTimeout(() => {
                setToast(null);
                onClose?.();
            }, 2500);
        } catch (e) {
            console.error('[D1-MMT] Submit network error', e);
            const msg = 'Could not reach server. Please try again.';
            setSubmitError(msg);
            setToast(msg);
            setTimeout(() => setToast(null), 3000);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <div className="flex items-center justify-between gap-2 px-6 py-2">
                <div>
                    <div className="font-bold text-sm">Measurement Date</div>
                    <CustomDatePicker className="w-[250px] mt-2" value={measurementDate} onChange={(date) => setMeasurementDate(date)} />
                </div>
                <div>
                    <div className="font-bold text-sm">Measurement Time</div>
                    <CustomTimePicker className="w-[250px] mt-2" value={measurementTime} onChange={(val) => setMeasurementTime(val)} />
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
                <div className="font-bold text-sm px-6">MMT Manager</div>
                <div className="w-full max-w-[540px] border border-gray-300 rounded-md p-2 ml-6 mt-2 flex items-center justify-between min-h-[53px]">
                    <div className="flex items-center gap-2 py-1.5 px-2 flex-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4 text-gray-400 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        <CustomSelect
                            value={selectedId}
                            onChange={(val) => setSelectedId(val)}
                            options={managers.map((m) => ({ value: String(m.id), label: m.name }))}
                            placeholder="Select MMT Manager"
                            className="flex-1"
                            size="md"
                        />
                        {selected && (
                            <span className="bg-[#EF0101]/80 rounded-full w-[8px] h-[8px] shrink-0 ml-2" title="Selected" />
                        )}
                    </div>
                    <div className="flex items-center shrink-0">
                        <div className="bg-[#DDCDC1]/20 rounded-md px-3 py-1.5 h-[32px] text-[#32261C] text-sm font-bold text-center flex items-center">
                            {loaded && managers.length === 0 ? 'None available' : 'Available'}
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4 ml-2 text-gray-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                    </div>
                </div>
                {loaded && managers.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1 px-6">No MMT managers in the system. Create via Admin → Create MMT Manager.</p>
                )}
                <div className="bg-gray-100 rounded-md w-[540px] h-[70px] p-2 ml-6 mt-10 flex items-center justify-between">
                    <div className="pl-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-gray-400 font-bold">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                        </svg>
                    </div>
                    <div className="text-[12px] text-gray-500 italic p-2 pl-4">
                        MMT manager will be notified by email to assign an MMT executive. Client visit mail is sent after that assignment.
                    </div>
                </div>
                {submitError && <p className="text-sm text-red-600 px-6 mt-2">{submitError}</p>}
                <div className="bg-gray-100 w-full h-[80px] rounded-b-2xl">
                    <div className="h-[1px] bg-gray-200 w-full mt-10" />
                    <button type="button" onClick={handleSubmit} disabled={submitting || !selectedId || !!toast} className="mt-5 ml-98 bg-[#00B0ED] rounded-md w-[150px] py-1.5 h-[36px] text-white text-sm font-bold text-center items-end disabled:opacity-60">
                        {submitting ? 'Submitting…' : 'Submit Request'}
                    </button>
                </div>
            </div>

            {toast && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white text-base font-medium px-8 py-4 rounded-lg shadow-2xl z-[9999] text-center max-w-md">
                    {toast}
                </div>
            )}
        </>
    );
}
