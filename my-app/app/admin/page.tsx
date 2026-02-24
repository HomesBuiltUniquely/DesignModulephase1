'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function AdminPanelPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'admin') router.replace('/');
  }, [user, loading, router]);

  if (loading || !user) return <div className="p-8">Loading…</div>;
  if (user.role !== 'admin') return null;

  const actions = [
    {
      title: 'Create Admin',
      description: 'Create another Admin who can access the Admin Panel and create users.',
      href: '/admin/create-admin',
      label: 'Create Admin',
    },
    {
      title: 'Create Territorial Design Manager',
      description: 'Add a new TDM who can register Design Managers and Designers.',
      href: '/admin/create-tdm',
      label: 'Create TDM',
    },
    {
      title: 'Create DQC Manager',
      description: 'Add a new Design Quality Check Manager who can register DQE (Design Quality Executive).',
      href: '/admin/create-dqc-manager',
      label: 'Create DQC Manager',
    },
    {
      title: 'Create MMT Manager',
      description: 'Add a new MMT (Measurement Team) Manager who can register MMT Executives.',
      href: '/admin/create-mmt-manager',
      label: 'Create MMT Manager',
    },
    {
      title: 'Create Finance Team',
      description: 'Create login for Finance Team members. They can sign in and access the app.',
      href: '/admin/create-finance',
      label: 'Create Finance Login',
    },
    {
      title: 'Create Project Manager',
      description: 'Add a new Project Manager who can manage projects and timelines.',
      href: '/admin/create-project-manager',
      label: 'Create Project Manager',
    },
    {
      title: 'Create Escalation Manager',
      description: 'Add a new Escalation Manager who can handle escalations.',
      href: '/admin/create-escalation-manager',
      label: 'Create Escalation Manager',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
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
      <main className="max-w-5xl mx-auto p-8">
        <p className="text-gray-600 mb-8">Create and manage users. Choose a role to create below.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {actions.map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="block p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-green-300 hover:shadow-md transition-all"
            >
              <h2 className="font-semibold text-gray-900">{action.title}</h2>
              <p className="text-sm text-gray-500 mt-2">{action.description}</p>
              <span className="inline-block mt-4 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
                {action.label}
              </span>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
