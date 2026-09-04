'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../auth/AuthContext';
import { BRANCH_OPTIONS } from '../constants/branches';
import CustomSelect from '@/app/Components/ui/CustomSelect';
import { getApiBase } from '@/app/lib/apiBase';

const API = getApiBase();

const CAN_ACCESS = new Set([
  'admin',
  'senior_project_manager',
  'territorial_design_manager',
  'deputy_general_manager',
]);

const CAN_DELETE = new Set(['admin', 'senior_project_manager']);

type ProjectManagerRow = {
  id: number;
  name?: string | null;
  email?: string | null;
};

export default function ProjectManagersPage() {
  const router = useRouter();
  const { user, sessionId, loading, logout } = useAuth();
  const role = (user?.role || '').toLowerCase();

  const [rows, setRows] = useState<ProjectManagerRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [branch, setBranch] = useState<string>(BRANCH_OPTIONS[0]);
  const [submitting, setSubmitting] = useState(false);

  const canDelete = CAN_DELETE.has(role);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!CAN_ACCESS.has(role)) router.replace('/');
  }, [user, loading, router, role]);

  const loadList = useCallback(async () => {
    if (!sessionId) return;
    setListLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/auth/project-managers`, {
        headers: { Authorization: `Bearer ${sessionId}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Failed to load project managers');
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'Failed to load project managers');
    } finally {
      setListLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((pm) => {
      const haystack = [String(pm.id), pm.name, pm.email].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, searchQuery]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith('@hubinterior.com')) {
      setError('Email must end with @hubinterior.com');
      return;
    }
    if (!sessionId) {
      setError('Session expired. Please log in again.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/create-project-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || email.trim(),
          phone: phone.trim(),
          branch: branch || BRANCH_OPTIONS[0],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to create Project Manager');
      setSuccess(`Project Manager created: ${data.user?.email || normalized}`);
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
      setBranch(BRANCH_OPTIONS[0]);
      await loadList();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create Project Manager');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(pm: ProjectManagerRow) {
    if (!canDelete) return;
    const label = pm.name || pm.email || `ID ${pm.id}`;
    const ok = window.confirm(
      `Delete Project Manager "${label}"?\n\nThey will be removed from any assigned leads. This cannot be undone.`,
    );
    if (!ok || !sessionId) return;
    setDeletingId(pm.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API}/api/auth/project-managers/${pm.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionId}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to delete Project Manager');
      setSuccess(data?.message || `Project Manager deleted: ${label}`);
      setRows((prev) => prev.filter((row) => row.id !== pm.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete Project Manager');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading || !user) return <div className="p-8">Loading…</div>;
  if (!CAN_ACCESS.has(role)) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Project Managers</h1>
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

      <main className="max-w-5xl mx-auto p-6 sm:p-8 space-y-8">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
        {success && (
          <div className="text-sm text-[#32261C] bg-[#DDCDC1]/20 border border-[#DDCDC1] rounded-lg px-3 py-2">
            {success}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-1">Create Project Manager</h2>
          <p className="text-sm text-gray-600 mb-4">
            Email must end with @hubinterior.com. They sign in on the main login page.
          </p>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                required
                placeholder="name@hubinterior.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                placeholder="Project Manager name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                placeholder="e.g. 9876543210"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
              <CustomSelect
                value={branch}
                onChange={(val) => setBranch(val)}
                options={BRANCH_OPTIONS.map((b) => ({ value: b, label: b }))}
                placeholder="Select branch"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                required
                placeholder="••••••••"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-[#EF0101] text-white font-semibold hover:bg-[#EF0101]/90 disabled:opacity-60"
              >
                {submitting ? 'Creating…' : 'Create Project Manager'}
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">All Project Managers</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {canDelete
                  ? 'Search and delete PM logins. Assigned leads are unassigned automatically.'
                  : 'Search PM logins. Only Admin or Senior Project Manager can delete.'}
              </p>
            </div>
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
                onClick={loadList}
                disabled={listLoading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                {listLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
              <div className="col-span-2">ID</div>
              <div className="col-span-4">Name</div>
              <div className={canDelete ? 'col-span-4' : 'col-span-6'}>Email</div>
              {canDelete && <div className="col-span-2 text-right">Action</div>}
            </div>
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-600">
                {listLoading
                  ? 'Loading…'
                  : searchQuery.trim()
                    ? 'No project managers match your search.'
                    : 'No project managers yet. Create one above.'}
              </div>
            ) : (
              filtered.map((pm) => {
                const busy = deletingId === pm.id;
                return (
                  <div
                    key={pm.id}
                    className="grid grid-cols-12 px-4 py-3 border-t border-gray-200 items-center gap-y-1"
                  >
                    <div className="col-span-2 text-sm font-semibold text-gray-900">{pm.id}</div>
                    <div className="col-span-4 text-sm text-gray-800">{pm.name || '—'}</div>
                    <div className={`${canDelete ? 'col-span-4' : 'col-span-6'} text-sm text-gray-600 truncate`}>
                      {pm.email || '—'}
                    </div>
                    {canDelete && (
                      <div className="col-span-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(pm)}
                          disabled={!sessionId || busy}
                          className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
                        >
                          {busy ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
