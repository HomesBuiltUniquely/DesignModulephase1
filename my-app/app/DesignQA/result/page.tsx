'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DesignQAResultPage() {
    const [submitted, setSubmitted] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Only read the flag; do not clear it here (avoids Strict Mode double-mount clearing before state updates)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const flag = sessionStorage.getItem('designQASubmitted');
            setSubmitted(flag === 'true');
        } finally {
            setLoaded(true);
        }
    }, []);

    // Clear the flag only after we've shown the thank-you state, so a refresh doesn't show thank-you again
    useEffect(() => {
        if (submitted && typeof window !== 'undefined') {
            sessionStorage.removeItem('designQASubmitted');
        }
    }, [submitted]);

    if (!loaded) {
        return (
            <div className="bg-white min-h-screen flex items-center justify-center p-4">
                <p className="text-gray-500 text-sm sm:text-base">Loading...</p>
            </div>
        );
    }

    if (!submitted) {
        return (
            <div className="bg-white min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
                <div className="w-full max-w-lg mx-auto bg-[#f1f2f6] rounded-3xl border-2 border-green-900 shadow-xl overflow-hidden p-6 sm:p-8 md:p-10 text-center">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-3 sm:mb-4">
                        Complete the questionnaire
                    </h1>
                    <p className="text-gray-600 text-sm sm:text-base mb-6 sm:mb-8">
                        Please complete the design questionnaire first.
                    </p>
                    <Link
                        href="/DesignQA"
                        className="inline-block px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-green-800 text-white font-semibold text-sm sm:text-base hover:bg-green-700 transition-colors"
                    >
                        Start questionnaire
                    </Link>
                </div>
                <div className="mt-6 w-full max-w-[200px] sm:max-w-[240px]">
                    <img src="/LOGOHOWs.png" alt="Logo" className="w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white min-h-screen flex flex-col items-center p-4 sm:p-6">
            <div className="w-full max-w-[200px] sm:max-w-[240px] mb-4 sm:mb-6">
                <img src="/LOGOHOWs.png" alt="Logo" className="w-full" />
            </div>
            <div className="w-full max-w-2xl mx-auto bg-[#f1f2f6] rounded-3xl border-2 border-green-900 shadow-xl overflow-hidden flex flex-col items-center justify-center py-10 sm:py-12 md:py-16 px-6 sm:px-8">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 text-center mb-3 sm:mb-4">
                    You have completed the questionnaire
                </h1>
                <p className="text-gray-700 text-base sm:text-lg text-center mb-8 sm:mb-10">
                    Thank you for submitting.
                </p>
                <Link
                    href="/DesignQA"
                    className="inline-block px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-green-800 text-white font-semibold text-sm sm:text-base hover:bg-green-700 transition-colors"
                >
                    Back to home
                </Link>
            </div>
        </div>
    );
}
