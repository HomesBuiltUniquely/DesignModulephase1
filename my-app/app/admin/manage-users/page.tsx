'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';

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
};

const TABS: Array<{ role: ManageRole; label: string }> = [
  { role: 'designer', label: 'Designers' },
  { role: 'design_manager', label: 'Design Managers' },
  { role: 'territorial_design_manager', label: 'TDMs' },
];

function roleLabel(role: ManageRole): string {
  if (role === 'designer') return 'Designer';
  if (role === 'design_manager') return 'Design Manager';
  return 'Territory Design Manager';
}

export default function AdminManageUsersPage() {
  const router = useRouter();
  const { user, sessionId, loading, logout } = useAuth();
  const [activeRole, setActiveRole] = useState<ManageRole>('designer');
  const [rows, setRows] = useState<ManagedUser[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'admin') router.replace('/');
  }, [user, loading, router]);

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
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, searchQuery]);

  async function handleDelete(row: ManagedUser) {
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

  if (loading || !user) return <div className="p-8">Loading…</div>;
  if (user.role !== 'admin') return null;

  const showManagerCol = activeRole === 'designer' || activeRole === 'design_manager';

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Manage Design Roles</h1>
          <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin Panel
          </a>
          <a href="/" className="text-sm text-[#32261C] hover:underline">
            Dashboard
          </a>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user.email}</span>
          <button
            type="button"
            onClick={() => logout().then(() => router.replace('/login'))}
            className="text-sm text-red-600 hover:underline"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 sm:p-8 space-y-6">
        <p className="text-sm text-gray-600">
          Search and delete Designers, Design Managers, or Territory Design Managers. Assignments are
          cleared automatically where needed.
        </p>

        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
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

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
              {roleLabel(activeRole)}s
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
                  placeholder="Search by name, email, ID..."
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

          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div
              className={`grid gap-2 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600 ${
                showManagerCol ? 'grid-cols-12' : 'grid-cols-12'
              }`}
            >
              <div className="col-span-1">ID</div>
              <div className={showManagerCol ? 'col-span-3' : 'col-span-4'}>Name</div>
              <div className={showManagerCol ? 'col-span-3' : 'col-span-5'}>Email</div>
              {showManagerCol && <div className="col-span-3">Reports to</div>}
              <div className="col-span-2 text-right">Action</div>
            </div>

            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-600">
                {listLoading
                  ? 'Loading…'
                  : searchQuery.trim()
                    ? 'No users match your search.'
                    : `No ${roleLabel(activeRole).toLowerCase()}s found.`}
              </div>
            ) : (
              filtered.map((row) => {
                const busy = deletingId === row.id;
                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-gray-200 items-center"
                  >
                    <div className="col-span-1 text-sm font-semibold text-gray-900">{row.id}</div>
                    <div className={`${showManagerCol ? 'col-span-3' : 'col-span-4'} text-sm text-gray-800`}>
                      {row.name || '—'}
                      {row.branch ? (
                        <span className="ml-2 text-xs text-gray-400">{row.branch}</span>
                      ) : null}
                    </div>
                    <div
                      className={`${showManagerCol ? 'col-span-3' : 'col-span-5'} text-sm text-gray-600 truncate`}
                    >
                      {row.email || '—'}
                    </div>
                    {showManagerCol && (
                      <div className="col-span-3 text-sm text-gray-600 truncate">
                        {row.managerName || row.managerEmail || '—'}
                      </div>
                    )}
                    <div className="col-span-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={!sessionId || busy}
                        className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
                      >
                        {busy ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
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
