'use client';

type Props = {
  onClose: () => void;
};

/**
 * Designer view for "D1 files upload" — no Mark as done.
 * Task completes automatically when MMT manager/admin approves (or uploads) D1 files.
 */
export default function PopupD1FilesWaiting({ onClose }: Props) {
  return (
    <div className="px-6 pb-6">
      <p className="text-sm text-gray-700 leading-relaxed mb-3">
        This task completes automatically — you do not need to mark it done.
      </p>
      <p className="text-sm text-gray-600 leading-relaxed mb-4">
        Once the <strong>MMT executive</strong> uploads the measurement files and the{' '}
        <strong>MMT manager</strong> (or admin) approves them, the files appear under{' '}
        <strong>Files Uploaded</strong> on this lead, and this task moves to the next milestone.
      </p>
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-5">
        If an MMT manager or admin uploads D1 files directly, approval is not required — the task
        completes and files show in Files Uploaded right away.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
      >
        Close
      </button>
    </div>
  );
}
