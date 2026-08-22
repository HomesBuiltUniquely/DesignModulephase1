'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { BRANCH_OPTIONS } from '../../constants/branches';
import CustomSelect from '@/app/Components/ui/CustomSelect';

import { getApiBase } from '@/app/lib/apiBase';
const API = getApiBase();

const CAN_CREATE_PM = new Set(['admin', 'territorial_design_manager', 'deputy_general_manager']);

export default function AdminCreateProjectManagerPage() {
  const router = useRouter();
  const { user, sessionId, loading, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [branch, setBranch] = useState<string>(BRANCH_OPTIONS[0]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!CAN_CREATE_PM.has((user.role || '').toLowerCase())) router.replace('/');
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith('@hubinterior.com')) {
      setMessage({ type: 'error', text: 'Email must end with @hubinterior.com' });
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
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() || email.trim(), phone: phone.trim(), branch: branch || BRANCH_OPTIONS[0] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to create Project Manager' });
        return;
      }
      setMessage({ type: 'success', text: `Project Manager created: ${data.user?.email}` });
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
      setBranch(BRANCH_OPTIONS[0]);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return <div className="p-8">Loading…</div>;
  if (!CAN_CREATE_PM.has((user.role || '').toLowerCase())) return null;

  const isAdmin = (user.role || '').toLowerCase() === 'admin';

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">
            {isAdmin ? 'Admin — Create Project Manager' : 'Create Project Manager'}
          </h1>
          <a href="/" className="text-sm text-[#32261C] hover:underline">Dashboard</a>
          {isAdmin ? (
            <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900">Admin Panel</a>
          ) : (
            <a href="/tdm/register" className="text-sm text-gray-600 hover:text-gray-900">TDM / DGM hub</a>
          )}
        </div>
        <div className="flex items-center gap-4">
          <a href="/change-password" className="text-sm text-gray-600 hover:text-gray-900">Change password</a>
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
      <main className="max-w-md mx-auto p-8">
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
          <p className="text-gray-600 text-sm mb-4">
            Admins, Territory Design Managers, and Deputy General Managers can create Project Manager logins. They sign in with the main login page and use the dashboard. Email must end with @hubinterior.com.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-[#DDCDC1]/20 text-[#32261C]' : 'bg-red-50 text-red-700'}`}>
                {message.text}
              </div>
            )}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                required
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
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-[#EF0101] text-white font-medium hover:bg-[#EF0101] disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create Project Manager'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
