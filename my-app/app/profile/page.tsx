'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

import { getApiBase } from '@/app/lib/apiBase';
const API = getApiBase();
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

function getInitials(name: string, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.trim().slice(0, 2).toUpperCase();
  }
  if (email?.trim()) return email.trim().slice(0, 2).toUpperCase();
  return '?';
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const t = (fullName ?? '').trim();
  if (!t) return { firstName: '', lastName: '' };
  const idx = t.indexOf(' ');
  if (idx <= 0) return { firstName: t, lastName: '' };
  return { firstName: t.slice(0, idx).trim(), lastName: t.slice(idx).trim() };
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, sessionId, loading, logout, refreshUser } = useAuth();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const { firstName: f, lastName: l } = splitName(user.name);
    setFirstName(f);
    setLastName(l);
    setEmail(user.email ?? '');
    setPhone(user.phone ?? '');
  }, [user?.id, user?.name, user?.email, user?.phone]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please choose an image file (e.g. JPG, PNG)' });
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setMessage({ type: 'error', text: 'Image must be 2MB or smaller' });
      return;
    }
    setSubmitting(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${API}/api/auth/profile-image`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to update profile image' });
        return;
      }
      await refreshUser();
      setMessage({ type: 'success', text: 'Profile photo updated.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.endsWith('@hubinterior.com')) {
      setMessage({ type: 'error', text: 'Email must end with @hubinterior.com' });
      return;
    }
    if (!phone.trim()) {
      setMessage({ type: 'error', text: 'Phone number is required' });
      return;
    }
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim();
    if (!fullName) {
      setMessage({ type: 'error', text: 'First name or last name is required' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({ name: fullName, email: trimmedEmail, phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to update profile' });
        return;
      }
      await refreshUser();
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
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

  const initials = getInitials(user.name, user.email);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Profile</h1>
          <a href="/" className="text-sm text-green-600 hover:underline">Dashboard</a>
          <a href="/change-password" className="text-sm text-gray-600 hover:text-gray-900">Change password</a>
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
      <main className="max-w-4xl mx-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
            <p className="text-gray-600 text-sm mb-6">Upload a photo for your profile. It will appear in the header and next to your name. Max 2MB, JPG or PNG.</p>
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center shrink-0">
                {user.profileImage ? (
                  <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold text-gray-500">{initials}</span>
                )}
              </div>
              {message && (
                <div
                  className={`w-full p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}
                >
                  {message.text}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={submitting}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
              >
                {submitting ? 'Uploading…' : 'Choose photo'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Edit your details</h2>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {message && (
              <div
                className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}
              >
                {message.text}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                  placeholder="Last name"
                />
              </div>
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
              <p className="text-xs text-gray-500 mt-1">Must end with @hubinterior.com</p>
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
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save details'}
            </button>
          </form>
          </div>
        </div>
      </main>
    </div>
  );
}
