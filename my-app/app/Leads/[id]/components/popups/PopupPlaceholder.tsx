'use client';

type Props = {
    message?: string;
};

/**
 * Placeholder for milestones/tasks that don't have popup content yet.
 */
export default function PopupPlaceholder({ message = 'Add your popup content here' }: Props) {
    return (
        <div className="px-6 pb-6">
            {message}
        </div>
    );
}
