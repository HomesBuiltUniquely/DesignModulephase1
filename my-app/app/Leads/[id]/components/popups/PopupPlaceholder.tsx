'use client';

type Props = {
    message?: string;
    onMarkComplete?: () => void;
};

/**
 * Placeholder for milestones/tasks that don't have popup content yet.
 */
export default function PopupPlaceholder({ message = 'Add your popup content here', onMarkComplete }: Props) {
    return (
        <div className="px-6 pb-6">
            <p className="mb-4">{message}</p>
            {onMarkComplete && (
                <button type="button" onClick={onMarkComplete} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">
                    Mark as done
                </button>
            )}
        </div>
    );
}
