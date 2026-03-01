'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

import { getApiBase } from '@/app/lib/apiBase';
const API = getApiBase();

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, sessionId, loading, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New password and confirm password do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to change password' });
        return;
      }
      setMessage({ type: 'success', text: 'Password updated successfully. You can sign in with your new password next time.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Change Password</h1>
          <a href="/" className="text-sm text-green-600 hover:underline">Dashboard</a>
          <a href="/profile" className="text-sm text-gray-600 hover:text-gray-900">Profile</a>
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
      <main className="max-w-md mx-auto p-8">
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
                }`}
              >
                {message.text}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                required
                minLength={6}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                required
                minLength={6}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
            >
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
