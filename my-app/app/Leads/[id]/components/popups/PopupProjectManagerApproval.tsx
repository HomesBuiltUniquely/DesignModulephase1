'use client';

type Props = {
    projectName: string;
    projectManagerName?: string | null;
    onApprove: () => void;
    onClose: () => void;
};

export default function PopupProjectManagerApproval({
    projectName,
    projectManagerName,
    onApprove,
    onClose,
}: Props) {
    return (
        <div className="px-6 pb-6">
            <p className="text-sm text-gray-600 mb-2">
                Project: <span className="font-medium text-gray-900">{projectName}</span>
            </p>
            <p className="text-sm text-gray-600 mb-4">
                Review DQC 2 files and lead uploads as needed. When everything is in order, approve to release this
                milestone and allow the team to proceed to the 40% payment stage.
            </p>
            {projectManagerName && (
                <p className="text-xs text-gray-500 mb-4">Signed in as assigned PM: {projectManagerName}</p>
            )}
            <div className="flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={onApprove}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                >
                    Approve and continue
                </button>
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50">
                    Close
                </button>
            </div>
        </div>
    );
}
