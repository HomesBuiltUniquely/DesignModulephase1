'use client';

import { useEffect, useState } from 'react';
import {
    canPickD2UploadAsRole,
    defaultD2UploadAsRole,
    d2UploadRoleLabel,
    type D2UploadAsRole,
} from '@/app/lib/d2UploadLabels';

type Props = {
    open: boolean;
    files: File[];
    userName?: string;
    userRole?: string;
    uploading?: boolean;
    onCancel: () => void;
    onConfirm: (uploadedAsRole: D2UploadAsRole) => void;
};

export default function D2UploadConfirmModal({
    open,
    files,
    userName,
    userRole,
    uploading,
    onCancel,
    onConfirm,
}: Props) {
    const role = (userRole || '').toLowerCase();
    const canPick = canPickD2UploadAsRole(role);
    const [uploadAs, setUploadAs] = useState<D2UploadAsRole>('senior_project_manager');

    useEffect(() => {
        if (!open) return;
        const def = defaultD2UploadAsRole(role);
        if (def) setUploadAs(def);
        else if (canPick) setUploadAs('senior_project_manager');
    }, [open, role, canPick]);

    if (!open || files.length === 0) return null;

    const attributionRole = canPick ? uploadAs : defaultD2UploadAsRole(role) ?? uploadAs;
    const attributionLabel = d2UploadRoleLabel(attributionRole);

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Confirm D2 PDF upload</h3>
                <p className="text-sm text-gray-600">
                    You are about to upload {files.length} PDF{files.length === 1 ? '' : 's'} for D2 site masking.
                </p>

                <ul className="max-h-32 overflow-y-auto text-sm text-gray-800 border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {files.map((f) => (
                        <li key={`${f.name}-${f.size}`} className="px-3 py-2 truncate">
                            {f.name}
                        </li>
                    ))}
                </ul>

                {canPick ? (
                    <fieldset className="space-y-2">
                        <legend className="text-sm font-medium text-gray-700">Uploaded by (select role)</legend>
                        <label className="flex items-center gap-2 text-sm text-gray-800">
                            <input
                                type="radio"
                                name="uploadAs"
                                checked={uploadAs === 'senior_project_manager'}
                                onChange={() => setUploadAs('senior_project_manager')}
                            />
                            Senior Project Manager
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-800">
                            <input
                                type="radio"
                                name="uploadAs"
                                checked={uploadAs === 'project_manager'}
                                onChange={() => setUploadAs('project_manager')}
                            />
                            Project Manager
                        </label>
                    </fieldset>
                ) : null}

                <div className="rounded-lg border border-[#DDCDC1] bg-[#DDCDC1]/20 px-3 py-2 text-sm text-[#32261C]">
                    This will be recorded as uploaded by{' '}
                    <strong>{userName || 'You'}</strong> ({attributionLabel}).
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={uploading}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(attributionRole)}
                        disabled={uploading}
                        className="px-4 py-2 text-sm bg-[#EF0101] text-white font-semibold rounded-lg hover:bg-[#EF0101]/90 disabled:opacity-60"
                    >
                        {uploading ? 'Uploading…' : 'Confirm upload'}
                    </button>
                </div>
            </div>
        </div>
    );
}
