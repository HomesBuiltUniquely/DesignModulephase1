'use client';

type Props = {
    cardClass: string;
    onToggleMaximize: () => void;
    isMaximized: boolean;
};

/**
 * Files Uploaded card in the lead detail grid.
 */
export default function FilesCard({ cardClass, onToggleMaximize, isMaximized }: Props) {
    return (
        <div className={cardClass}>
            <div className="flex justify-between xl:justify-arround px-4">
                <h2 className="text-lg font-bold text-gray-900">Files Uploaded</h2>
                <button
                    onClick={onToggleMaximize}
                    className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50 shadow-sm"
                    aria-label={isMaximized ? 'Minimize' : 'Maximize'}
                >
                    {isMaximized ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v-4.5m0 4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                    )}
                </button>
            </div>
            <h1 className="xl:mt-25">....... Under Construction .......</h1>
        </div>
    );
}
