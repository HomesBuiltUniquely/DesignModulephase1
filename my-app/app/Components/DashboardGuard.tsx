'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import Dashboard from './Dashboard';

export default function DashboardGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;
    if (pathname === '/login') return;
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [user, loading, pathname, router]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div>
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-green-700 font-semibold">Dashboard</a>
          {(user.role === 'territorial_design_manager' || user.role === 'dqc_manager' || user.role === 'mmt_manager' || user.role === 'mmt_executive' || user.role === 'finance' || user.role === 'admin') && (
            <>
              {user.role === 'territorial_design_manager' && <a href="/tdm/register" className="text-gray-600 hover:text-gray-900 text-sm">Register DM / Designer</a>}
              {user.role === 'dqc_manager' && <a href="/dqc-manager/register" className="text-gray-600 hover:text-gray-900 text-sm">Register DQE</a>}
              {(user.role === 'finance' || user.role === 'admin') && (
                <>
                  <a href="/finance" className="text-gray-600 hover:text-gray-900 text-sm">10% Payment</a>
                  <a href="/finance/40" className="text-gray-600 hover:text-gray-900 text-sm">40% Payment</a>
                </>
              )}
              {user.role === 'mmt_manager' && (
                <>
                  <a href="/mmt-manager/register" className="text-gray-600 hover:text-gray-900 text-sm">Register MMT Executive</a>
                  <a href="/mmt" className="text-gray-600 hover:text-gray-900 text-sm">D1 Uploads</a>
                  <a href="/d2-uploads" className="text-gray-600 hover:text-gray-900 text-sm">D2 Uploads</a>
                </>
              )}
              {user.role === 'mmt_executive' && (
                <>
                  <a href="/mmt" className="text-gray-600 hover:text-gray-900 text-sm">D1 Uploads</a>
                  <a href="/d2-uploads" className="text-gray-600 hover:text-gray-900 text-sm">D2 Uploads</a>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              aria-expanded={settingsOpen}
              aria-haspopup="true"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a7.723 7.723 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <span>Settings</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-50">
                <a href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setSettingsOpen(false)}>
                  Profile
                </a>
                <a href="/change-password" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setSettingsOpen(false)}>
                  Change password
                </a>
                {user.role === 'admin' && (
                  <a href="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setSettingsOpen(false)}>
                    Admin Panel
                  </a>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center shrink-0">
              {user.profileImage ? (
                <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-medium text-gray-500">
                  {user.name?.trim() ? user.name.trim().split(/\s+/).length >= 2
                    ? (user.name.trim().split(/\s+/)[0][0] + user.name.trim().split(/\s+/).pop()![0]).toUpperCase()
                    : user.name.trim().slice(0, 2).toUpperCase()
                    : user.email?.trim().slice(0, 2).toUpperCase() || '?'}
                </span>
              )}
            </div>
            <span className="text-sm text-gray-600">{user.name} ({user.role.replace(/_/g, ' ')})</span>
          </div>
          <button type="button" onClick={() => logout().then(() => router.replace('/login'))} className="text-sm text-red-600 hover:underline">Logout</button>
        </div>
      </header>
      <main>
        <Dashboard />
      </main>
    </div>
  );
}
