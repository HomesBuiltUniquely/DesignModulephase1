'use client';

import { useCallback, useState } from 'react';
import { getApiBase } from '@/app/lib/apiBase';

const API = getApiBase();

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  leadPid: number;
};

function pickAccessToken(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const t = o.access_token ?? o.accessToken ?? o.token;
  return typeof t === 'string' && t.trim() ? t.trim() : null;
}

function formatBody(data: unknown): string {
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export default function PopupProlance({ open, onClose, sessionId, leadPid }: Props) {
  const [plToken, setPlToken] = useState('');
  const [originSession, setOriginSession] = useState('');
  const [tokenUsername, setTokenUsername] = useState('');
  const [tokenPassword, setTokenPassword] = useState('');
  const [loginID, setLoginID] = useState('');
  const [password, setPassword] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [optionId, setOptionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [lastBody, setLastBody] = useState<string>('');
  const [configOk, setConfigOk] = useState<boolean | null>(null);

  const appAuthHeaders = useCallback((): HeadersInit => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionId) h.Authorization = `Bearer ${sessionId}`;
    const t = plToken.trim();
    if (t) h['X-Prolance-Token'] = t;
    const o = originSession.trim();
    if (o) h['X-Prolance-Origin-Session'] = o;
    return h;
  }, [sessionId, plToken, originSession]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (!sessionId) {
        setLastStatus(null);
        setLastBody('Sign in to use Prolance.');
        return;
      }
      setBusy(true);
      setLastStatus(null);
      setLastBody('');
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    },
    [sessionId],
  );

  const parseJson = async (res: Response) => {
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // keep text
    }
    setLastStatus(res.status);
    setLastBody(formatBody(data));
    return { res, data };
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prolance-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-purple-200 bg-slate-900 text-purple-100 shadow-xl">
        <div className="flex items-center justify-between border-b border-purple-800/80 px-4 py-3">
          <h2 id="prolance-title" className="text-lg font-bold text-white">
            Prolance <span className="text-purple-300 font-normal text-sm">(PID {leadPid})</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-purple-200 hover:bg-purple-900/50"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 px-4 py-4 text-sm">
          {!sessionId && (
            <p className="rounded-md bg-amber-900/40 px-3 py-2 text-amber-100">You need to be signed in to call Prolance APIs.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !sessionId}
              onClick={() =>
                run(async () => {
                  const res = await fetch(`${API}/api/prolance/status`, { headers: appAuthHeaders() });
                  const { data } = await parseJson(res);
                  if (res.ok && data && typeof data === 'object' && 'configured' in data) {
                    setConfigOk(!!(data as { configured?: boolean }).configured);
                  }
                })
              }
              className="rounded-md border border-purple-500/60 px-3 py-1.5 font-medium text-white hover:bg-purple-900/40 disabled:opacity-40"
            >
              Check config
            </button>
            <button
              type="button"
              disabled={busy || !sessionId}
              onClick={() =>
                run(async () => {
                  const res = await fetch(`${API}/api/prolance/token`, {
                    method: 'POST',
                    headers: appAuthHeaders(),
                    body: JSON.stringify({ username: tokenUsername.trim(), password: tokenPassword }),
                  });
                  const { data } = await parseJson(res);
                  const tok = pickAccessToken(data);
                  if (tok) setPlToken(tok);
                })
              }
              className="rounded-md border border-green-700/80 px-3 py-1.5 font-medium text-green-100 hover:bg-green-900/30 disabled:opacity-40"
            >
              Get API token
            </button>
          </div>
          {configOk === false && (
            <p className="text-xs text-amber-200">Server reports PROLANCE_BASE_URL is not set. Ask ops to configure it.</p>
          )}

          <div className="grid grid-cols-1 gap-2 border border-purple-800/40 rounded-lg p-3">
            <p className="text-xs font-semibold text-purple-200">Token (grant_type=password)</p>
            <input
              placeholder="API username"
              value={tokenUsername}
              onChange={(e) => setTokenUsername(e.target.value)}
              className="rounded border border-purple-700/80 bg-slate-950 px-2 py-1.5 text-xs"
              autoComplete="off"
            />
            <input
              placeholder="API password"
              type="password"
              value={tokenPassword}
              onChange={(e) => setTokenPassword(e.target.value)}
              className="rounded border border-purple-700/80 bg-slate-950 px-2 py-1.5 text-xs"
              autoComplete="off"
            />
            <p className="text-[11px] text-purple-300">
              Your Prolance API Key (OriginAPIKey) is handled server-side; you don’t need to paste it here.
            </p>
          </div>

          <label className="block">
            <span className="text-xs text-purple-300">X-Prolance-Token (paste or use Get API token)</span>
            <input
              value={plToken}
              onChange={(e) => setPlToken(e.target.value)}
              className="mt-1 w-full rounded border border-purple-700/80 bg-slate-950 px-2 py-1.5 text-xs text-white"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="text-xs text-purple-300">Origin session (optional, overrides server default)</span>
            <input
              value={originSession}
              onChange={(e) => setOriginSession(e.target.value)}
              className="mt-1 w-full rounded border border-purple-700/80 bg-slate-950 px-2 py-1.5 text-xs text-white"
              autoComplete="off"
            />
          </label>

          <div className="grid grid-cols-1 gap-2 border-t border-purple-800/60 pt-3">
            <p className="text-xs font-semibold text-purple-200">Partner login</p>
            <input
              placeholder="Login ID"
              value={loginID}
              onChange={(e) => setLoginID(e.target.value)}
              className="rounded border border-purple-700/80 bg-slate-950 px-2 py-1.5 text-xs"
            />
            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded border border-purple-700/80 bg-slate-950 px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              disabled={busy || !sessionId || !plToken.trim()}
              onClick={() =>
                run(async () => {
                  const res = await fetch(`${API}/api/prolance/partners/login`, {
                    method: 'POST',
                    headers: appAuthHeaders(),
                    body: JSON.stringify({ loginID, password }),
                  });
                  const { data } = await parseJson(res);
                  const tok = pickAccessToken(data);
                  if (tok) setPlToken(tok);
                })
              }
              className="rounded-md bg-purple-700 px-3 py-2 font-medium text-white hover:bg-purple-600 disabled:opacity-40"
            >
              Partner login
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 border-t border-purple-800/60 pt-3">
            <p className="text-xs font-semibold text-purple-200">Projects &amp; rooms</p>
            <input
              placeholder="Partner ID"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className="rounded border border-purple-700/80 bg-slate-950 px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              disabled={busy || !sessionId || !plToken.trim() || !partnerId.trim()}
              onClick={() =>
                run(async () => {
                  const res = await fetch(
                    `${API}/api/prolance/projects/${encodeURIComponent(partnerId.trim())}`,
                    { headers: appAuthHeaders() },
                  );
                  await parseJson(res);
                })
              }
              className="rounded-md border border-purple-500/60 px-3 py-1.5 text-left hover:bg-purple-900/40 disabled:opacity-40"
            >
              List projects
            </button>
            <input
              placeholder="Project ID (for quotes)"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="rounded border border-purple-700/80 bg-slate-950 px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              disabled={busy || !sessionId || !plToken.trim() || !projectId.trim()}
              onClick={() =>
                run(async () => {
                  const res = await fetch(
                    `${API}/api/prolance/rooms/quotes/${encodeURIComponent(projectId.trim())}`,
                    { headers: appAuthHeaders() },
                  );
                  await parseJson(res);
                })
              }
              className="rounded-md border border-purple-500/60 px-3 py-1.5 text-left hover:bg-purple-900/40 disabled:opacity-40"
            >
              Room quotes
            </button>
            <input
              placeholder="Option ID (hardware / BOQ)"
              value={optionId}
              onChange={(e) => setOptionId(e.target.value)}
              className="rounded border border-purple-700/80 bg-slate-950 px-2 py-1.5 text-xs"
            />
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['Hardware', 'hardware'],
                  ['Services', 'services'],
                  ['Skirtings', 'skirtings'],
                  ['Worktops', 'worktops'],
                  ['Appliances', 'appliances'],
                  ['Modules BOQ', 'modules-boq'],
                ] as const
              ).map(([label, slug]) => (
                <button
                  key={slug}
                  type="button"
                  disabled={busy || !sessionId || !plToken.trim() || !optionId.trim()}
                  onClick={() =>
                    run(async () => {
                      const oid = encodeURIComponent(optionId.trim());
                      const path =
                        slug === 'modules-boq'
                          ? `${API}/api/prolance/rooms/options/modules-boq/${oid}`
                          : `${API}/api/prolance/rooms/options/${oid}/${slug}`;
                      const res = await fetch(path, { headers: appAuthHeaders() });
                      await parseJson(res);
                    })
                  }
                  className="rounded border border-purple-600/50 px-2 py-1 text-xs hover:bg-purple-900/40 disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {(lastStatus !== null || lastBody) && (
            <div className="border-t border-purple-800/60 pt-3">
              <p className="text-xs text-purple-300">
                Last response{lastStatus !== null ? ` (HTTP ${lastStatus})` : ''}
              </p>
              <pre className="mt-1 max-h-52 overflow-auto rounded bg-slate-950 p-2 text-[11px] leading-relaxed text-green-100/90">
                {lastBody || '—'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
