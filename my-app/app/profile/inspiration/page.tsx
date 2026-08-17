'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';
import CustomSelect from '@/app/Components/ui/CustomSelect';

const API = getApiBase();
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const CATEGORIES = ['LIVING ROOM', 'BEDROOM', 'KITCHEN', 'OTHER'] as const;
type Category = (typeof CATEGORIES)[number];

type InspirationProject = {
  id: string;
  title: string;
  description: string;
  category: Category;
  imageUrl?: string | null;
};

function newId() {
  return `insp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeCategory(raw: unknown): Category {
  const value = String(raw ?? 'OTHER').trim().toUpperCase();
  return (CATEGORIES as readonly string[]).includes(value) ? (value as Category) : 'OTHER';
}

export default function InspirationProjectsPage() {
  const router = useRouter();
  const { user, sessionId, loading, logout, refreshUser } = useAuth();
  const [projects, setProjects] = useState<InspirationProject[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const list = Array.isArray(user.designerInspirationProjects)
      ? user.designerInspirationProjects.map((p) => ({
          id: String(p.id || newId()),
          title: String(p.title || ''),
          description: String(p.description || ''),
          category: normalizeCategory(p.category),
          imageUrl: p.imageUrl ?? null,
        }))
      : [];
    setProjects(
      list.length
        ? list
        : [{ id: newId(), title: '', description: '', category: 'LIVING ROOM', imageUrl: null }],
    );
  }, [user?.id, user?.designerInspirationProjects]);

  function updateRow(id: string, patch: Partial<InspirationProject>) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function addRow() {
    setProjects((prev) => [
      ...prev,
      { id: newId(), title: '', description: '', category: 'LIVING ROOM', imageUrl: null },
    ]);
  }

  function removeRow(id: string) {
    setProjects((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)));
  }

  async function handleImagePick(id: string, file: File | undefined) {
    setMessage(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please choose an image file (JPG, PNG, or WebP)' });
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setMessage({ type: 'error', text: 'Image must be 2MB or smaller' });
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
    updateRow(id, { imageUrl: dataUrl });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    setMessage(null);
    const cleaned = projects
      .map((p) => ({
        id: p.id,
        title: p.title.trim(),
        description: p.description.trim(),
        category: p.category,
        imageUrl: p.imageUrl?.trim() || null,
      }))
      .filter((p) => p.title);

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/inspiration-projects`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({ projects: cleaned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to save inspiration projects' });
        return;
      }
      await refreshUser();
      setMessage({
        type: 'success',
        text: 'Portfolio projects saved. They appear on Meeting Wizard Designer portfolio.',
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
          <h1 className="text-xl font-bold text-gray-900">Portfolio projects</h1>
          <Link href="/profile" className="text-sm text-gray-600 hover:text-gray-900">
            Profile
          </Link>
          <Link href="/profile/experience" className="text-sm text-gray-600 hover:text-gray-900">
            Experience
          </Link>
          <Link href="/" className="text-sm text-[#32261C] hover:underline">
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

      <main className="max-w-3xl mx-auto p-8">
        <p className="text-sm text-gray-600 mb-6">
          Upload project photos with a category (Living Room, Bedroom, Kitchen). These feed the Meeting Wizard
          Designer portfolio gallery and filters. Title is required for each entry.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          {message ? (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === 'success' ? 'bg-[#DDCDC1]/20 text-[#32261C]' : 'bg-red-50 text-red-700'
              }`}
            >
              {message.text}
            </div>
          ) : null}

          {projects.map((project, index) => (
            <div
              key={project.id}
              className="bg-white rounded-2xl shadow border border-gray-200 p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-gray-900">Project {index + 1}</h2>
                <button
                  type="button"
                  onClick={() => removeRow(project.id)}
                  className="text-sm text-red-600 hover:underline disabled:opacity-40"
                  disabled={projects.length <= 1}
                >
                  Remove
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  value={project.title}
                  onChange={(e) => updateRow(project.id, { title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                  placeholder="e.g. Soft Scandinavian living suite"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <CustomSelect
                  value={project.category}
                  onChange={(val) => updateRow(project.id, { category: val as Category })}
                  options={CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                  placeholder="Select Category"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description / notes</label>
                <textarea
                  value={project.description}
                  onChange={(e) => updateRow(project.id, { description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                  placeholder="What makes this project inspiring for client meetings?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project image</label>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="w-28 h-28 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                    {project.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={project.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-gray-400 px-2 text-center">No image</span>
                    )}
                  </div>
                  <div className="space-y-2 min-w-0 flex-1">
                    <input
                      ref={(el) => {
                        fileRefs.current[project.id] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        void handleImagePick(project.id, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRefs.current[project.id]?.click()}
                      className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      {project.imageUrl ? 'Replace image' : 'Upload image'}
                    </button>
                    {project.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => updateRow(project.id, { imageUrl: null })}
                        className="block text-sm text-red-600 hover:underline"
                      >
                        Remove image
                      </button>
                    ) : null}
                    <p className="text-xs text-gray-500">Max 2MB. JPG, PNG, or WebP.</p>
                    <input
                      value={
                        project.imageUrl && !project.imageUrl.startsWith('data:')
                          ? project.imageUrl
                          : ''
                      }
                      onChange={(e) => updateRow(project.id, { imageUrl: e.target.value || null })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm"
                      placeholder="Or paste an image URL (https://…)"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addRow}
              className="px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Add project
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 rounded-lg bg-[#EF0101] text-white text-sm font-medium hover:bg-[#EF0101] disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save portfolio projects'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
