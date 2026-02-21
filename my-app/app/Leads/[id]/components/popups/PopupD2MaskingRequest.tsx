'use client';

/**
 * D2 - masking request raise: same structure as D1 MMT request (date, time, assignment, submit).
 */
export default function PopupD2MaskingRequest() {
    return (
        <>
            <div className="flex items-center justify-between gap-2 px-6 py-2">
                <div>
                    <div className="font-bold text-sm">Masking Date</div>
                    <input type="date" className="w-[250px] border border-gray-300 rounded-md p-2 mt-2" />
                </div>
                <div>
                    <div className="font-bold text-sm">Masking Time</div>
                    <input type="time" className="w-[250px] border border-gray-300 rounded-md p-2 mt-2" />
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
                <div className="font-bold text-sm px-6">Masking Executive</div>
                <div className="w-[540px] h-[53px] border border-gray-300 rounded-md p-2 ml-6 mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 py-1.5 px-2">
                        <div>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                        </div>
                        <div className="flex items-center gap-2 pl-2">
                            <p className="bg-green-500 rounded-full w-[8px] h-[8px]" />
                            <p className="text-[14px] text-gray-600 font-bold">Alex Johnson</p>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <div className="bg-green-50 rounded-md w-[150px] py-1.5 h-[32px] text-green-600 text-sm font-bold text-center">Available Today</div>
                        <div className="pl-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-100 rounded-md w-[540px] h-[70px] p-2 ml-6 mt-10 flex items-center justify-between">
                    <div className="pl-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-gray-400 font-bold">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                        </svg>
                    </div>
                    <div className="text-[12px] text-gray-500 italic p-2 pl-4">The customer will be notified automatically via SMS and Email once the D2 masking request is submitted</div>
                </div>
                <div className="bg-gray-100 w-full h-[80px] rounded-b-2xl">
                    <div className="h-[1px] bg-gray-200 w-full mt-10" />
                    <button className="mt-5 ml-98 bg-blue-500 rounded-md w-[150px] py-1.5 h-[36px] text-white text-sm font-bold text-center items-end">Submit Request</button>
                </div>
            </div>
        </>
    );
}
