'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type ImageOption = {
    id: number;
    src: string;
    alt: string;
    css: string;
    text: string;
};

type AnswerEntry = {
    question: string;
    selected: ImageOption | null;
    optionLabel?: string;
};

export default function DesignQAResultPage() {
    const [answers, setAnswers] = useState<AnswerEntry[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = sessionStorage.getItem('designQAAnswers');
            if (raw) {
                const parsed = JSON.parse(raw) as AnswerEntry[];
                setAnswers(Array.isArray(parsed) ? parsed : []);
            }
        } finally {
            setLoaded(true);
        }
    }, []);

    if (!loaded) {
        return (
            <div className="bg-white min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading your choices...</p>
            </div>
        );
    }

    if (answers.length === 0) {
        return (
            <div className="bg-white min-h-screen flex flex-col items-center justify-center gap-6 p-8">
                <h1 className="text-2xl font-bold text-gray-800">No design choices found</h1>
                <p className="text-gray-600 text-center">Complete the design questionnaire first.</p>
                <Link
                    href="/DesignQA"
                    className="px-6 py-3 rounded-xl bg-green-800 text-white font-semibold hover:bg-green-700"
                >
                    Start questionnaire
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-white min-h-screen">
            <main>
                <div className="xl:w-[16%] xl:z-10 xl:-ml-16">
                    <img src="/LOGOHOWs.png" alt="Logo" />
                </div>

                <div className="xl:mx-auto xl:w-[75%] xl:bg-[#f1f2f6] xl:rounded-4xl xl:border-3 xl:border-green-900 xl:shadow-2xl xl:overflow-hidden">
                    <h1 className="xl:text-black xl:text-2xl xl:font-bold xl:text-center pt-10 pb-2">
                        Your design choices
                    </h1>
                    <p className="text-center text-gray-600 pb-8">
                        Summary of all {answers.length} questions
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 p-12">
                        {answers.map((entry, index) => (
                            <div
                                key={index}
                                className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                            >
                                <p className="px-4 pt-4 pb-2 font-semibold text-gray-800 text-sm border-b border-gray-100">
                                    Q{index + 1}: {entry.question}
                                </p>
                                {entry.selected ? (
                                    <>
                                        {entry.selected.src ? (
                                            <div className="aspect-video w-full overflow-hidden">
                                                <img
                                                    src={entry.selected.src}
                                                    alt={entry.selected.alt}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : null}
                                        <p className={`px-4 font-bold text-sm ${entry.selected.src ? 'py-3 text-green-800' : 'pt-4 pb-3 text-green-800'}`}>
                                            {entry.optionLabel ?? entry.selected.text}
                                        </p>
                                    </>
                                ) : (
                                    <p className="px-4 py-6 text-gray-400">No selection</p>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-center pb-12">
                        <Link
                            href="/DesignQA"
                            className="px-6 py-3 rounded-xl border-2 border-green-800 text-green-800 font-semibold hover:bg-green-50"
                        >
                            Start over
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
