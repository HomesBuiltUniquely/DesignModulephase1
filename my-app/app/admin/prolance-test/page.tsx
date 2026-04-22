'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';

const API = getApiBase();
const CREATE_RESPONSE_STORAGE_KEY = 'prolance_create_project_responses_v1';

type CreateProjectLog = {
  at: string;
  status: number;
  request: {
    partnerID: number;
    pName: string;
    customer: string;
    city: string;
    state: string;
    projectType: string;
  };
  response: unknown;
  projectID?: number | null;
  quote?: {
    status: number;
    response: unknown;
  } | null;
};

function pretty(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function readProjectIdFromCreateResponse(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  const direct = root.projectID ?? root.projectId;
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  if (typeof direct === 'string' && direct.trim()) {
    const parsed = Number(direct);
    if (Number.isFinite(parsed)) return parsed;
  }
  const nestedData = root.data;
  if (Array.isArray(nestedData) && nestedData.length > 0 && nestedData[0] && typeof nestedData[0] === 'object') {
    const first = nestedData[0] as Record<string, unknown>;
    const nestedId = first.projectID ?? first.projectId;
    if (typeof nestedId === 'number' && Number.isFinite(nestedId)) return nestedId;
    if (typeof nestedId === 'string' && nestedId.trim()) {
      const parsed = Number(nestedId);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export default function ProlanceTestPage() {
  const router = useRouter();
  const { user, sessionId, loading, logout } = useAuth();

  const [token, setToken] = useState('');
  const [sessionRef, setSessionRef] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [projectName, setProjectName] = useState('CRM Test Project');
  const [customerName, setCustomerName] = useState('CRM Test Customer');
  const [city, setCity] = useState('Bengaluru');
  const [stateName, setStateName] = useState('Karnataka');
  const [projectType, setProjectType] = useState('CYO');
  const [originApiKey, setOriginApiKey] = useState('');
  const [quoteProjectId, setQuoteProjectId] = useState('');
  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [lastBody, setLastBody] = useState('');
  const [createProjectLogs, setCreateProjectLogs] = useState<CreateProjectLog[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return void router.replace('/login');
    if (user.role !== 'admin') return void router.replace('/');
  }, [loading, user, router]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CREATE_RESPONSE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setCreateProjectLogs(parsed as CreateProjectLog[]);
    } catch {
      // Ignore invalid local storage data.
    }
  }, []);

  const appHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionId) h.Authorization = `Bearer ${sessionId}`;
    if (token.trim()) h['X-Prolance-Token'] = token.trim();
    if (sessionRef.trim()) h['X-Prolance-Origin-Session'] = sessionRef.trim();
    if (originApiKey.trim()) h['X-Prolance-API-Key'] = originApiKey.trim();
    return h;
  };

  const run = async (fn: () => Promise<void>) => {
    if (!sessionId) {
      setLastStatus(null);
      setLastBody('Session missing. Login again.');
      return;
    }
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const parse = async (res: Response) => {
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // keep text
    }
    setLastStatus(res.status);
    setLastBody(pretty(data));
    return { ok: res.ok, data };
  };

  const saveCreateProjectLog = (entry: CreateProjectLog) => {
    setCreateProjectLogs((prev) => {
      const next = [entry, ...prev].slice(0, 20);
      try {
        localStorage.setItem(CREATE_RESPONSE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage quota/write errors.
      }
      return next;
    });
  };

  if (loading || !user) return <div className="p-8">Loading…</div>;
  if (user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Admin — Prolance Test API</h1>
          <a href="/" className="text-sm text-green-600 hover:underline">Dashboard</a>
          <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900">Admin Panel</a>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user.email}</span>
          <button type="button" onClick={() => logout().then(() => router.replace('/login'))} className="text-sm text-red-600 hover:underline">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-8 space-y-4">
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-6 space-y-3">
          <p className="text-sm text-gray-600">This page calls <code>/api/prolance-test/*</code> only (safe test namespace).</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-gray-700 mb-1">Access Token (auto from Generate Token)</span>
              <input value={token} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block text-gray-700 mb-1">Origin Session ID (auto from Partner Login)</span>
              <input value={sessionRef} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2" />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(async () => {
                const res = await fetch(`${API}/api/prolance-test/token`, { method: 'POST', headers: appHeaders(), body: JSON.stringify({}) });
                const { data } = await parse(res);
                const t = (data && typeof data === 'object' ? (data as any).access_token : null);
                if (typeof t === 'string') setToken(t);
              })}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-60"
            >
              Generate Token
            </button>
            <button
              type="button"
              disabled={busy || !token.trim()}
              onClick={() => run(async () => {
                const res = await fetch(`${API}/api/prolance-test/partners/login`, {
                  method: 'POST',
                  headers: appHeaders(),
                  body: JSON.stringify({}),
                });
                const { data } = await parse(res);
                const s = data && typeof data === 'object' ? (data as any)?.data?.[0]?.sessionID : null;
                const p = data && typeof data === 'object' ? (data as any)?.data?.[0]?.partnerID : null;
                if (typeof s === 'string') setSessionRef(s);
                if (typeof p === 'number' || typeof p === 'string') setPartnerId(String(p));
              })}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-60"
            >
              Partner Login
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Headers sent from UI to our backend</p>
              <pre className="text-[11px] text-gray-700 whitespace-pre-wrap">{pretty({
                Authorization: sessionId ? `Bearer ${sessionId}` : '(missing app sessionId)',
                'X-Prolance-Token': token || '(from Generate Token)',
                'X-Prolance-Origin-Session': sessionRef || '(from Partner Login)',
                'X-Prolance-API-Key': originApiKey || '(optional; else backend env PROLANCE_API_KEY)',
                'Content-Type': 'application/json',
              })}</pre>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Headers backend sends to Prolance (exact API keys)</p>
              <pre className="text-[11px] text-gray-700 whitespace-pre-wrap">{pretty({
                Authorization: token ? `Bearer ${token}` : 'Bearer <access_token>',
                OriginSessionID: sessionRef || '<session_id>',
                OriginAPIKey: originApiKey || '(from backend env PROLANCE_API_KEY)',
                NoEncryption: '1',
                'Content-Type': 'application/json',
              })}</pre>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow border border-gray-200 p-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-sm md:col-span-1">
              <span className="block text-gray-700 mb-1">Partner ID (auto from Partner Login)</span>
              <input value={partnerId} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm md:col-span-1">
              <span className="block text-gray-700 mb-1">Project Name</span>
              <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm md:col-span-1">
              <span className="block text-gray-700 mb-1">Customer</span>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm md:col-span-1">
              <span className="block text-gray-700 mb-1">City/State</span>
              <input value={`${city} / ${stateName}`} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm md:col-span-1">
              <span className="block text-gray-700 mb-1">Project Type</span>
              <input value={projectType} onChange={(e) => setProjectType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm md:col-span-1">
              <span className="block text-gray-700 mb-1">Origin API Key (optional override)</span>
              <input
                type="password"
                value={originApiKey}
                onChange={(e) => setOriginApiKey(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !token.trim() || !sessionRef.trim() || !partnerId.trim()}
              onClick={() => run(async () => {
                const res = await fetch(`${API}/api/prolance-test/projects/${encodeURIComponent(partnerId.trim())}`, {
                  method: 'GET',
                  headers: appHeaders(),
                });
                await parse(res);
              })}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-60"
            >
              Get Projects
            </button>
            <button
              type="button"
              disabled={busy || !token.trim() || !sessionRef.trim() || !partnerId.trim()}
              onClick={() => run(async () => {
                const payload = {
                  partnerID: Number(partnerId),
                  pName: projectName,
                  customer: customerName,
                  city,
                  state: stateName,
                  projectType: projectType || 'CYO',
                };
                const res = await fetch(`${API}/api/prolance-test/projects/create`, {
                  method: 'PUT',
                  headers: appHeaders(),
                  body: JSON.stringify(payload),
                });
                const { ok, data } = await parse(res);
                const projectID = readProjectIdFromCreateResponse(data);
                let quote: CreateProjectLog['quote'] = null;
                if (ok && projectID != null) setQuoteProjectId(String(projectID));
                saveCreateProjectLog({
                  at: new Date().toISOString(),
                  status: res.status,
                  request: payload,
                  response: data,
                  projectID,
                  quote,
                });
              })}
              className="px-3 py-2 rounded-lg bg-purple-600 text-white text-sm disabled:opacity-60"
            >
              Create Project
            </button>
            <div className="flex items-center gap-2">
              <input
                value={quoteProjectId}
                onChange={(e) => setQuoteProjectId(e.target.value)}
                placeholder="Project ID for quote"
                className="w-44 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busy || !token.trim() || !sessionRef.trim() || !quoteProjectId.trim()}
                onClick={() => run(async () => {
                  const quoteRes = await fetch(`${API}/api/prolance-test/quotes/${encodeURIComponent(quoteProjectId.trim())}`, {
                    method: 'GET',
                    headers: appHeaders(),
                  });
                  await parse(quoteRes);
                })}
                className="px-3 py-2 rounded-lg bg-sky-600 text-white text-sm disabled:opacity-60"
              >
                Get Quote
              </button>
            </div>
          </div>
        </div>

        <div className="bg-black text-green-200 rounded-xl p-4">
          <p className="text-xs mb-2">Last response{lastStatus ? ` (HTTP ${lastStatus})` : ''}</p>
          <pre className="text-xs whitespace-pre-wrap">{lastBody || '—'}</pre>
        </div>

        <div className="bg-white rounded-2xl shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-800">Saved Create Project Responses (latest 20)</p>
            <button
              type="button"
              onClick={() => {
                setCreateProjectLogs([]);
                try {
                  localStorage.removeItem(CREATE_RESPONSE_STORAGE_KEY);
                } catch {
                  // Ignore localStorage errors.
                }
              }}
              className="px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-700 hover:bg-gray-200"
            >
              Clear
            </button>
          </div>
          <pre className="text-xs text-gray-800 whitespace-pre-wrap max-h-64 overflow-auto">
            {createProjectLogs.length ? pretty(createProjectLogs) : 'No saved create-project responses yet.'}
          </pre>
        </div>
      </main>
    </div>
  );
}

