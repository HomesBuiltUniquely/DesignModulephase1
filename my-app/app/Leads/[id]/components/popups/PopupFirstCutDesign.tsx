'use client';

import type { RefObject } from 'react';

type Props = {
    designUploadFiles: File[];
    designFileInputRef: RefObject<HTMLInputElement | null>;
    openDesignFileUpload: (accept: string) => void;
    onDesignFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onDesignDrop: (e: React.DragEvent) => void;
    onDesignDragOver: (e: React.DragEvent) => void;
    removeDesignFile: (index: number) => void;
};

/**
 * First cut design + quotation discussion meeting request – date, time, meeting mode, design upload.
 */
export default function PopupFirstCutDesign({
    designUploadFiles,
    designFileInputRef,
    openDesignFileUpload,
    onDesignFilesSelected,
    onDesignDrop,
    onDesignDragOver,
    removeDesignFile,
}: Props) {
    return (
        <div className="w-full min-h-[100vh]">
            <div>
                <div className="w-full border border-gray-200 mt-2" />
                <div className="flex items-center gap-2 py-4 px-6">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-blue-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                    <div className="text-[14px] font-bold text-black">MEETING SCHEDULE</div>
                </div>
                <div className="flex items-center justify-between gap-2 px-6 py-2">
                    <div>
                        <div className="font-bold text-sm text-black">Date</div>
                        <input type="date" className="w-[250px] border border-gray-300 rounded-md p-2 mt-2" />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-black">Time</div>
                        <input type="time" className="w-[250px] border border-gray-300 rounded-md p-2 mt-2" />
                    </div>
                </div>
                <div className="flex items-center gap-2 py-4 px-6">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-blue-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <div className="text-[14px] font-bold text-black">MEETING MODE</div>
                </div>
                <div className="flex justify-around gap-4 bg-gray-200 w-47 h-12 rounded-md ml-5">
                    <div className="text-blue-400 bg-white w-20 h-[4.5vh] text-center font-bold mt-1.5 pt-1.5 ml-1.5 rounded-md">Online</div>
                    <div className="w-20 h-[4.5vh] text-center text-gray-400 font-bold mt-1.5 pt-1.5">Offline</div>
                </div>
                <div>
                    <h1 className="pl-6 pt-4 font-semibold text-black">Meeting Link</h1>
                    <div className="relative w-138.75 mt-4 ml-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 absolute left-3 top-3 text-gray-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                        </svg>
                        <input className="w-full h-12.5 border border-gray-300 rounded-xl placeholder-gray-500 font-medium text-[18px] pl-13" placeholder="https://zoom.us/j/..." />
                    </div>
                </div>
                <div className="flex items-center gap-2 py-4 px-6 mt-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 text-blue-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                    </svg>
                    <div className="text-[14px] text-black font-bold">DESIGN UPLOAD</div>
                </div>
                <div className="px-6 pb-6">
                    <input ref={designFileInputRef} type="file" className="hidden" multiple onChange={onDesignFilesSelected} />
                    <div
                        className="w-full max-w-[540px] border-2 border-dashed border-gray-300 rounded-xl bg-white p-8 flex flex-col items-center justify-center min-h-[220px] cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                        onClick={() => openDesignFileUpload('.pdf,.jpg,.jpeg,.png,.fig,.psd')}
                        onDrop={onDesignDrop}
                        onDragOver={onDesignDragOver}
                    >
                        <div className="w-14 h-14 rounded-full border-2 border-blue-200 bg-blue-50 flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7 text-blue-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                            </svg>
                        </div>
                        <p className="text-base font-semibold text-gray-800 mb-1">Click or drag design file to upload</p>
                        <p className="text-sm text-gray-500 mb-6">Upload first design version for discussion</p>
                        <div className="flex items-center justify-center gap-4 flex-wrap">
                            <button type="button" onClick={(e) => { e.stopPropagation(); openDesignFileUpload('.pdf'); }} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-red-600 font-medium text-sm">PDF</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); openDesignFileUpload('.jpg,.jpeg,.png'); }} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-blue-600 font-medium text-sm">JPG/PNG</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); openDesignFileUpload('.fig,.psd'); }} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-purple-600 font-medium text-sm">FIG/PSD</button>
                        </div>
                    </div>
                    {designUploadFiles.length > 0 && (
                        <div className="mt-3 space-y-2 max-w-[540px]">
                            <p className="text-sm font-medium text-gray-700">Selected files ({designUploadFiles.length})</p>
                            {designUploadFiles.map((file, index) => (
                                <div key={`${file.name}-${index}`} className="flex items-center justify-between text-sm bg-gray-100 rounded-lg px-3 py-2">
                                    <span className="text-gray-700 truncate flex-1">{file.name}</span>
                                    <button type="button" onClick={() => removeDesignFile(index)} className="text-red-600 hover:underline ml-2 flex-shrink-0">Remove</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="w-full border border-gray-200 mt-4" />
                <div className="flex justify-between bg-gray-100">
                    <div className="flex items-center gap-2 py-4 px-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-black">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                        </svg>
                        <div className="text-[13px] text-black w-75">Customer will receive calender invite automatically</div>
                    </div>
                    <div className="flex items-center justify-between gap-6 mr-5 py-6">
                        <div className="text-[16px] text-gray-600">Cancel</div>
                        <button className="bg-blue-500 text-white w-35 h-9 rounded-md flex pl-3 pt-1.5 gap-2 font-bold">
                            Send Invite{' '}
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
