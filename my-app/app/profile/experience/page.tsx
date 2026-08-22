'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';

const API = getApiBase();

export default function DesignerExperiencePage() {
  const router = useRouter();
  const { user, sessionId, loading, logout, refreshUser } = useAuth();
  const [title, setTitle] = useState('');
  const [experience, setExperience] = useState('');
  const [projects, setProjects] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [quote, setQuote] = useState('');
  const [sqft, setSqft] = useState('');
  const [awards, setAwards] = useState('');
  const [satisfaction, setSatisfaction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    setTitle(user.designerTitle ?? '');
    setExperience(user.designerExperience ?? '');
    setProjects(user.designerProjects ?? '');
    setSpecialty(user.designerSpecialty ?? '');
    setQuote(user.designerQuote ?? '');
    setSqft(user.designerSqft ?? '');
    setAwards(user.designerAwards ?? '');
    setSatisfaction(user.designerSatisfaction ?? '');
  }, [
    user?.id,
    user?.designerTitle,
    user?.designerExperience,
    user?.designerProjects,
    user?.designerSpecialty,
    user?.designerQuote,
    user?.designerSqft,
    user?.designerAwards,
    user?.designerSatisfaction,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/designer-experience`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({
          designerTitle: title.trim(),
          designerExperience: experience.trim(),
          designerProjects: projects.trim(),
          designerSpecialty: specialty.trim(),
          designerQuote: quote.trim(),
          designerSqft: sqft.trim(),
          designerAwards: awards.trim(),
          designerSatisfaction: satisfaction.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to save experience' });
        return;
      }
      await refreshUser();
      setMessage({
        type: 'success',
        text: 'Experience & portfolio stats saved. They show on Meeting Wizard Intro and Designer portfolio.',
      });
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
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900">Experience</h1>
          <Link href="/profile" className="text-sm text-gray-600 hover:text-gray-900">
            Profile
          </Link>
          <Link href="/profile/inspiration" className="text-sm text-gray-600 hover:text-gray-900">
            Portfolio projects
          </Link>
          <Link href="/" className="text-sm text-green-600 hover:underline">
            Dashboard
          </Link>
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

      <main className="max-w-3xl mx-auto p-8 space-y-6">
        <p className="text-sm text-gray-600">
          Advisor card fields show on Meeting Wizard Intro. Portfolio stats (projects completed, sq. ft., awards,
          satisfaction) show on the Designer portfolio step.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow border border-gray-200 p-6 space-y-4"
          >
            <h2 className="font-semibold text-gray-900">Your experience profile</h2>
            {message ? (
              <div
                className={`p-3 rounded-lg text-sm ${
                  message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                placeholder="e.g. Lead Interior Architect"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
              <input
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                placeholder="e.g. 12 Years"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Projects completed</label>
              <input
                value={projects}
                onChange={(e) => setProjects(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                placeholder="e.g. 140+"
              />
              <p className="text-xs text-gray-500 mt-1">Used on Intro card and portfolio &quot;Projects completed&quot;.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
              <input
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                placeholder="e.g. Modern Luxury"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inspiration quote</label>
              <textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                placeholder='e.g. Creating spaces that breathe and inspire.'
              />
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <h3 className="font-semibold text-gray-900">Portfolio stats</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sq. ft. designed</label>
                <input
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                  placeholder="e.g. 250k+"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Awards won</label>
                <input
                  value={awards}
                  onChange={(e) => setAwards(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                  placeholder="e.g. 12"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client satisfaction</label>
                <input
                  value={satisfaction}
                  onChange={(e) => setSatisfaction(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                  placeholder="e.g. 4.9/5"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save experience'}
            </button>
          </form>

          {/* Live preview matching Meeting Wizard card */}
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-6 flex flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 self-start">
              Meeting Wizard preview
            </p>
            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-emerald-200 bg-gray-100 flex items-center justify-center">
              {user.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-gray-500">
                  {(user.name || '?').slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900">{user.name}</p>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                {title.trim() || 'Interior Designer'}
              </p>
            </div>
            <div className="w-full border-t border-gray-100 pt-3 space-y-2">
              {[
                { label: 'Experience', value: experience.trim() || '—' },
                { label: 'Projects', value: projects.trim() || '—' },
                { label: 'Specialty', value: specialty.trim() || '—' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-sm gap-3">
                  <span className="text-gray-400">{row.label}</span>
                  <span className="font-semibold text-gray-900 text-right">{row.value}</span>
                </div>
              ))}
            </div>
            {quote.trim() ? (
              <p className="text-xs italic text-gray-400 text-center mt-1">&ldquo;{quote.trim()}&rdquo;</p>
            ) : null}
            <div className="w-full border-t border-gray-100 pt-3 grid grid-cols-2 gap-3 text-center">
              {[
                { value: projects.trim() || '—', label: 'Projects' },
                { value: sqft.trim() || '—', label: 'Sq. ft.' },
                { value: awards.trim() || '—', label: 'Awards' },
                { value: satisfaction.trim() || '—', label: 'Satisfaction' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-sm font-extrabold text-gray-900">{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
