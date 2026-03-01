'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { BRANCH_OPTIONS } from '../../constants/branches';

import { getApiBase } from '@/app/lib/apiBase';
const API = getApiBase();

type RegisterRole = 'design_manager' | 'designer';

export default function TdmRegisterPage() {
  const router = useRouter();
  const { user, sessionId, loading, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [branch, setBranch] = useState<string>(BRANCH_OPTIONS[0]);
  const [role, setRole] = useState<RegisterRole>('designer');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'territorial_design_manager') router.replace('/');
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
      const res = await fetch(`${API}/api/auth/register`, {
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
          role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Registration failed' });
        return;
      }
      setMessage({ type: 'success', text: `${role === 'design_manager' ? 'Design Manager' : 'Designer'} created: ${data.user?.email}` });
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
  if (user.role !== 'territorial_design_manager') return null;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Register Design Manager / Designer</h1>
          <a href="/" className="text-sm text-green-600 hover:underline">Dashboard</a>
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
          <p className="text-gray-600 text-sm mb-4">Register Design Managers and Designers. Email must end with @hubinterior.com.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                {message.text}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as RegisterRole)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white"
              >
                <option value="designer">Designer</option>
                <option value="design_manager">Design Manager</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white" required>
                {BRANCH_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
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
                placeholder="Full name"
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
              className="w-full py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
            >
              {submitting ? 'Registering…' : `Register ${role === 'design_manager' ? 'Design Manager' : 'Designer'}`}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
