'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../auth/AuthContext';
import { redirectToLoginPage } from '@/app/lib/externalLoginUrl';
import { getApiBase } from '@/app/lib/apiBase';
import {
  DESIGNER_SUB_ROLE_OPTIONS,
  formatDesignerSubRoleLabel,
  type DesignerSubRoleCode,
} from '@/app/lib/formatDesignerSubRoleLabel';

const API = getApiBase();

type ManageRole = 'designer' | 'design_manager' | 'territorial_design_manager';

type ManagedUser = {
  id: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  branch?: string | null;
  phone?: string | null;
  managerName?: string | null;
  managerEmail?: string | null;
  subRole?: string | null;
};

const ALL_TABS: Array<{ role: ManageRole; label: string }> = [
  { role: 'designer', label: 'Designers' },
  { role: 'design_manager', label: 'Design Managers' },
  { role: 'territorial_design_manager', label: 'TDMs' },
];

function roleLabel(role: ManageRole): string {
  if (role === 'designer') return 'Designer';
  if (role === 'design_manager') return 'Design Manager';
  return 'Territory Design Manager';
}

function normalizeSubRoleValue(raw?: string | null): DesignerSubRoleCode | '' {
  const key = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (DESIGNER_SUB_ROLE_OPTIONS.some((o) => o.value === key)) {
    return key as DesignerSubRoleCode;
  }
  return '';
}

export default function AdminManageUsersPage() {
  const router = useRouter();
  const { user, sessionId, loading } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';
  const isTdm = (user?.role || '').toLowerCase() === 'territorial_design_manager';
  const canAccess = isAdmin || isTdm;

  const tabs = useMemo(
    () => (isTdm && !isAdmin ? ALL_TABS.filter((t) => t.role === 'designer') : ALL_TABS),
    [isAdmin, isTdm],
  );

  const [activeRole, setActiveRole] = useState<ManageRole>('designer');
  const [rows, setRows] = useState<ManagedUser[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      redirectToLoginPage();
      return;
    }
    if (!canAccess) router.replace('/');
  }, [user, loading, router, canAccess]);

  useEffect(() => {
    if (isTdm && !isAdmin && activeRole !== 'designer') {
      setActiveRole('designer');
    }
  }, [isTdm, isAdmin, activeRole]);

  const loadUsers = useCallback(async () => {
    if (!sessionId) return;
    setListLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/auth/admin/users?role=${encodeURIComponent(activeRole)}`, {
        headers: { Authorization: `Bearer ${sessionId}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Failed to load users');
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setListLoading(false);
    }
  }, [sessionId, activeRole]);

  useEffect(() => {
    setSearchQuery('');
    setSuccess(null);
    loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        String(row.id),
        row.name,
        row.email,
        row.branch,
        row.phone,
        row.managerName,
        row.managerEmail,
        formatDesignerSubRoleLabel(row.subRole),
        row.subRole,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, searchQuery]);

  async function handleDelete(row: ManagedUser) {
    if (!isAdmin) return;
    const label = row.name || row.email || `ID ${row.id}`;
    const ok = window.confirm(
      `Delete ${roleLabel(activeRole)} "${label}"?\n\nRelated assignments will be cleared. This cannot be undone.`,
    );
    if (!ok || !sessionId) return;

    setDeletingId(row.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API}/api/auth/admin/users/${row.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionId}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to delete user');
      setSuccess(data?.message || `${roleLabel(activeRole)} deleted: ${label}`);
      setRows((prev) => prev.filter((u) => u.id !== row.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubRoleChange(row: ManagedUser, next: DesignerSubRoleCode) {
    if (!sessionId || activeRole !== 'designer') return;
    const current = normalizeSubRoleValue(row.subRole);
    if (current === next) return;

    const label = row.name || row.email || `ID ${row.id}`;
    const fromLabel = formatDesignerSubRoleLabel(row.subRole);
    const toLabel = formatDesignerSubRoleLabel(next);
    const ok = window.confirm(
      `Change career level for "${label}"?\n\n${fromLabel} → ${toLabel}`,
    );
    if (!ok) {
      // Re-sync controlled <select> after browser mutates the option on cancel.
      setRows((prev) => prev.map((u) => (u.id === row.id ? { ...u } : u)));
      return;
    }

    setUpdatingId(row.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API}/api/auth/admin/users/${row.id}/sub-role`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${sessionId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subRole: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to update career level');
      const updated = (data as { user?: { subRole?: string } }).user?.subRole || next;
      setRows((prev) =>
        prev.map((u) => (u.id === row.id ? { ...u, subRole: updated } : u)),
      );
      setSuccess(`Updated ${label}: ${fromLabel} → ${toLabel}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update career level');
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading || !user) return <div className="p-8">Loading…</div>;
  if (!canAccess) return null;

  const showManagerCol = activeRole === 'designer' || activeRole === 'design_manager';
  const showCareerCol = activeRole === 'designer';
  const showDelete = isAdmin;
  // Wider email column; career level sits left-aligned in a compact column next to Action.
  const rowGrid =
    showCareerCol && showDelete
      ? 'grid-cols-[48px_minmax(120px,1.1fr)_minmax(240px,1.8fr)_minmax(120px,1fr)_minmax(180px,200px)_88px]'
      : showCareerCol
        ? 'grid-cols-[48px_minmax(120px,1.1fr)_minmax(240px,2fr)_minmax(120px,1fr)_minmax(180px,200px)]'
        : showManagerCol
          ? 'grid-cols-[48px_minmax(120px,1.2fr)_minmax(240px,2fr)_minmax(120px,1fr)_88px]'
          : 'grid-cols-[48px_minmax(140px,1.2fr)_minmax(240px,2fr)_88px]';

  return (
    <div className="min-h-screen bg-slate-100">
      <main className="max-w-6xl mx-auto p-6 sm:p-8 space-y-6">
        <h1 className="mb-2 text-xl font-bold text-gray-900">Manage Design Roles</h1>
        <p className="text-sm text-gray-600">
          {isTdm && !isAdmin
            ? 'Change career levels for designers under your Design Managers (Intern → Principal).'
            : 'Change designer career levels (Intern → Principal). Admins can also delete Designers, Design Managers, or TDMs.'}
        </p>

        {tabs.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.role}
                type="button"
                onClick={() => setActiveRole(tab.role)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
                  activeRole === tab.role
                    ? 'bg-[#EF0101] text-white border-[#EF0101]'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
              {roleLabel(activeRole)}s
              {isTdm && !isAdmin ? ' in your territory' : ''}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-72">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.8}
                    stroke="currentColor"
                    className="w-4 h-4 text-gray-400"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z"
                    />
                  </svg>
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, level..."
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#00B0ED]/30 focus:border-[#00B0ED]"
                />
              </div>
              <button
                type="button"
                onClick={loadUsers}
                disabled={listLoading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                {listLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {success && (
            <div className="text-sm text-[#32261C] bg-[#DDCDC1]/20 border border-[#DDCDC1] rounded-lg px-3 py-2">
              {success}
            </div>
          )}

          <div className="border border-gray-200 rounded-2xl overflow-x-auto">
            <div
              className={`grid ${rowGrid} gap-3 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600 min-w-[780px]`}
            >
              <div>ID</div>
              <div>Name</div>
              <div>Email</div>
              {showManagerCol && <div>Reports to</div>}
              {showCareerCol && <div>Career level</div>}
              {showDelete && <div className="text-right">Action</div>}
            </div>

            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-600 min-w-[780px]">
                {listLoading
                  ? 'Loading…'
                  : searchQuery.trim()
                    ? 'No users match your search.'
                    : `No ${roleLabel(activeRole).toLowerCase()}s found.`}
              </div>
            ) : (
              filtered.map((row) => {
                const busyDelete = deletingId === row.id;
                const busyUpdate = updatingId === row.id;
                const selectValue = normalizeSubRoleValue(row.subRole);
                return (
                  <div
                    key={row.id}
                    className={`grid ${rowGrid} gap-3 px-4 py-3 border-t border-gray-200 items-center min-w-[780px]`}
                  >
                    <div className="text-sm font-semibold text-gray-900">{row.id}</div>
                    <div className="text-sm text-gray-800 min-w-0">
                      <span className="break-words">{row.name || '—'}</span>
                      {row.branch ? (
                        <span className="ml-1.5 text-xs text-gray-400 whitespace-nowrap">{row.branch}</span>
                      ) : null}
                    </div>
                    <div className="text-sm text-gray-600 min-w-0 break-all">
                      {row.email || '—'}
                    </div>
                    {showManagerCol && (
                      <div className="text-sm text-gray-600 min-w-0 truncate">
                        {row.managerName || row.managerEmail || '—'}
                      </div>
                    )}
                    {showCareerCol && (
                      <div className="min-w-0">
                        <select
                          value={selectValue}
                          disabled={!sessionId || busyUpdate}
                          onChange={(e) => {
                            const next = e.target.value as DesignerSubRoleCode;
                            if (!next) return;
                            void handleSubRoleChange(row, next);
                          }}
                          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B0ED]/30 focus:border-[#00B0ED] disabled:opacity-60"
                          aria-label={`Career level for ${row.name || row.email || row.id}`}
                        >
                          {!selectValue && (
                            <option value="" disabled>
                              Select career level…
                            </option>
                          )}
                          {DESIGNER_SUB_ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {busyUpdate && (
                          <p className="mt-1 text-xs text-gray-500">Saving…</p>
                        )}
                      </div>
                    )}
                    {showDelete && (
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          disabled={!sessionId || busyDelete}
                          className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
                        >
                          {busyDelete ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {searchQuery.trim() && filtered.length > 0 && (
            <p className="text-xs text-gray-500">
              Showing {filtered.length} of {rows.length}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
