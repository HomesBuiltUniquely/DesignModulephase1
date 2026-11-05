'use client';

import React, { useState, useEffect } from 'react';
import type { ImageType } from '../types';

type AssignableUser = {
    id: number;
    name: string;
    email: string;
    role: string;
    profileImage: string | null;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    leadId: number | string;
    sessionId: string | null;
    existingMembers: ImageType[];
    onMemberChanged: () => void;
};

export default function AddMemberModal({
    isOpen,
    onClose,
    leadId,
    sessionId,
    existingMembers,
    onMemberChanged,
}: Props) {
    const [users, setUsers] = useState<AssignableUser[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [selectedRole, setSelectedRole] = useState<string>('Team Member');
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    const authHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionId) headers.Authorization = `Bearer ${sessionId}`;
        return headers;
    };

    useEffect(() => {
        if (!isOpen || !sessionId) return;
        setLoading(true);
        setError(null);
        setSelectedUserId('');
        setSelectedRole('Team Member');

        fetch(`${API}/api/users/assignable-team`, {
            headers: authHeaders(),
            credentials: 'include',
        })
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load team users');
                return res.json();
            })
            .then((data: AssignableUser[]) => {
                if (Array.isArray(data)) {
                    setUsers(data);
                }
            })
            .catch((err) => {
                console.error('Error loading assignable users:', err);
                setError('Could not load user list');
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, API, sessionId]);

    if (!isOpen) return null;

    const existingUserIds = new Set(existingMembers.map((m) => Number(m.id)));
    const availableUsers = users.filter((u) => !existingUserIds.has(Number(u.id)));

    const handleSelectUser = (idStr: string) => {
        setSelectedUserId(idStr);
        const u = users.find((x) => String(x.id) === idStr);
        if (u) {
            setSelectedRole(u.role || 'Team Member');
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const userId = Number(selectedUserId);
        if (!userId) {
            setError('Please select a user to add');
            return;
        }
        if (!sessionId) {
            setError('Your session expired. Sign in again and retry.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/project-members`, {
                method: 'POST',
                headers: authHeaders(),
                credentials: 'include',
                body: JSON.stringify({ userId, role: selectedRole || 'manual' }),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || 'Failed to add project member');
            }
            onMemberChanged();
            setSelectedUserId('');
            setSelectedRole('Team Member');
        } catch (err: any) {
            setError(err.message || 'Failed to add project member');
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (userId: number) => {
        if (!sessionId) {
            setError('Your session expired. Sign in again and retry.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/project-members/${userId}`, {
                method: 'DELETE',
                headers: authHeaders(),
                credentials: 'include',
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || 'Failed to remove member');
            }
            onMemberChanged();
        } catch (err: any) {
            setError(err.message || 'Failed to remove member');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-white max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Project Team Members</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Manage users involved in this project</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="mt-4 rounded-lg bg-red-950/60 border border-red-500/50 p-3 text-xs text-red-200">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAdd} className="mt-4 space-y-3">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Add New Member
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <select
                                value={selectedUserId}
                                onChange={(e) => handleSelectUser(e.target.value)}
                                disabled={loading || saving || !sessionId}
                                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                            >
                                <option value="">— Select User —</option>
                                {availableUsers.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} ({u.role})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <input
                                type="text"
                                placeholder="Role (e.g. 3D Visualizer)"
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                disabled={loading || saving || !selectedUserId}
                                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-1">
                        <button
                            type="submit"
                            disabled={loading || saving || !selectedUserId || !sessionId}
                            className="px-4 py-1.5 rounded-lg bg-[#EF0101] text-white text-xs font-bold hover:bg-[#d00101] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? 'Adding...' : '+ Add to Project'}
                        </button>
                    </div>
                </form>

                <div className="mt-6 flex-1 overflow-y-auto border-t border-slate-800 pt-4">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Current Members ({existingMembers.length})
                    </h3>
                    {existingMembers.length === 0 ? (
                        <p className="text-sm text-slate-400 py-4 px-1">
                            No project members stored yet. Open this lead after 10–20% (or run the membership
                            backfill) to auto-populate designer, DM, TDM, and other roles. You can still add
                            people manually above.
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {existingMembers.map((m) => {
                                const initials = (m.name || '').trim()
                                    ? (m.name!.trim().split(/\s+/).length >= 2
                                        ? (m.name!.trim().split(/\s+/)[0][0] + m.name!.trim().split(/\s+/).pop()![0]).toUpperCase()
                                        : m.name!.trim().slice(0, 2).toUpperCase())
                                    : '?';
                                return (
                                    <div
                                        key={m.id}
                                        className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-750"
                                    >
                                        <div className="flex items-center gap-3">
                                            {m.img ? (
                                                <img
                                                    src={m.img}
                                                    alt=""
                                                    className="w-8 h-8 rounded-full border border-slate-700 object-cover"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center bg-slate-700 text-white text-xs font-bold">
                                                    {initials}
                                                </div>
                                            )}
                                            <div>
                                                <div className="text-sm font-medium text-white">{m.name}</div>
                                                <div className="text-xs text-slate-400">
                                                    {m.projectRole || 'Team Member'}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            {m.isManual ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemove(m.id)}
                                                    disabled={saving}
                                                    className="text-xs font-medium text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-950/40 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            ) : (
                                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                                                    Auto
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
