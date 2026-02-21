'use client';

import type { RefObject } from 'react';

type Props = {
    momMinutes: string;
    setMomMinutes: (v: string) => void;
    momReferenceFiles: File[];
    momFileInputRef: RefObject<HTMLInputElement | null>;
    openMomFileUpload: () => void;
    onMomFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMomDrop: (e: React.DragEvent) => void;
    removeMomFile: (index: number) => void;
    onClose: () => void;
};

/**
 * Meeting completed – Minutes of Meeting (MOM) popup.
 */
export default function PopupMeetingCompleted({
    momMinutes,
    setMomMinutes,
    momReferenceFiles,
    momFileInputRef,
    openMomFileUpload,
    onMomFilesSelected,
    onMomDrop,
    removeMomFile,
    onClose,
}: Props) {
    return (
        <div className="px-6 pb-6 max-w-[640px] mt-6">
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-blue-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <h2 className="text-xl font-bold text-gray-900">Minutes of Meeting (MOM)</h2>
                    </div>
                    <p className="text-sm text-gray-500">Submit official meeting summary to unlock next project stage.</p>
                </div>
                <span className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-orange-400 text-orange-600 text-xs font-bold rounded whitespace-nowrap">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                    STAGE EXIT LOCK
                </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Meeting Participants</label>
                    <input type="text" readOnly className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-700 bg-gray-50 text-sm" value="John Doe (Client), Sarah Miller (Lead Architect), Mike Ross (PM)" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Date / Time</label>
                    <input type="text" readOnly className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-700 bg-gray-50 text-sm" value="Oct 24, 2023 | 10:30 AM - 11:45 AM (GMT +5:30)" />
                </div>
            </div>
            <div className="mb-6">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-sm font-bold text-gray-800">Minutes of the Meeting (MOM)</label>
                    <span className="text-xs text-gray-400">Required Field</span>
                </div>
                <textarea
                    value={momMinutes}
                    onChange={(e) => setMomMinutes(e.target.value)}
                    placeholder={'• Customer liked kitchen layout; requested granite countertop switch.\n• Agreed on 15th Nov for next site visit.\n• Budget ceiling confirmed at $45,000.'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-gray-700 text-sm min-h-[140px] resize-y"
                    rows={6}
                />
                <div className="flex items-start gap-2 mt-2 p-3 bg-gray-100 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>
                    <p className="text-xs text-gray-600">Please ensure all final decisions and client approvals are documented clearly for audit purposes.</p>
                </div>
            </div>
            <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-800 mb-1">Reference Images / Markups / Screenshots</h3>
                <p className="text-xs text-gray-500 mb-3">Attach visual proof discussed during the meeting.</p>
                <input ref={momFileInputRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" multiple onChange={onMomFilesSelected} />
                <div className="flex gap-4 flex-wrap">
                    <div
                        onClick={openMomFileUpload}
                        onDrop={(e) => { e.preventDefault(); onMomDrop(e); }}
                        onDragOver={(e) => e.preventDefault()}
                        className="flex-1 min-w-[200px] border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-gray-100 transition-colors"
                    >
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-blue-600"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                        </div>
                        <p className="text-sm font-medium text-gray-700">Drag & drop files</p>
                        <p className="text-xs text-gray-500 mt-0.5">JPG, PNG, PDF up to 10MB</p>
                    </div>
                    {[0, 1].map((i) => (
                        <div key={i} className="w-[120px] h-[100px] border border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center overflow-hidden">
                            {momReferenceFiles[i] ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                    <p className="text-xs text-gray-600 truncate w-full text-center" title={momReferenceFiles[i].name}>{momReferenceFiles[i].name}</p>
                                    <button type="button" onClick={() => removeMomFile(i)} className="text-xs text-red-600 mt-1">Remove</button>
                                </div>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor" className="w-8 h-8 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
                                    <span className="text-xs text-gray-500 mt-1">SLOT {i + 1}</span>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex items-start gap-2 mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                <p className="text-xs text-gray-700"><strong>LEGAL DISCLAIMER:</strong> THIS MOM WILL BE TREATED AS OFFICIAL DESIGN DISCUSSION RECORD AND WILL BE USED AS THE PRIMARY REFERENCE FOR DISPUTE RESOLUTION OR STAGE SIGN-OFFS.</p>
            </div>
            <div className="flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="button" className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1">
                    Share the MOM <span className="pl-2"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 fill-white"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg></span>
                </button>
            </div>
        </div>
    );
}
