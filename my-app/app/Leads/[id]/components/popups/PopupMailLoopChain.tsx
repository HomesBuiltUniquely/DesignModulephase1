'use client';

import { useState, useEffect } from 'react';

import { getApiBase } from '@/app/lib/apiBase';
const API = getApiBase();

type TeamMemberEmail = { name: string; email: string };

type TeamEmails = {
  admins: TeamMemberEmail[];
  territorial_design_managers: TeamMemberEmail[];
  design_managers: TeamMemberEmail[];
};

type Props = {
  leadId?: number | null;
  clientEmail: string;
  /** Family member email (one) — stored as alternate client email */
  alternateClientEmail?: string;
  designerEmail: string;
  designManagerEmail?: string;
  sessionId: string | null;
  onEmailsSaved?: (emails: { clientEmail: string | null; alternateClientEmail: string | null }) => void;
  onMarkComplete: () => void;
  onClose: () => void;
};

/**
 * Task: Mail loop chain 2 initiate — verify loop members, add client / family emails.
 */
export default function PopupMailLoopChain({
  leadId,
  clientEmail,
  alternateClientEmail = '',
  designerEmail,
  designManagerEmail = '',
  sessionId,
  onEmailsSaved,
  onMarkComplete,
  onClose,
}: Props) {
  const [primary, setPrimary] = useState((clientEmail || '').trim());
  const [familyEmail, setFamilyEmail] = useState((alternateClientEmail || '').trim());
  const [baselinePrimary, setBaselinePrimary] = useState((clientEmail || '').trim().toLowerCase());
  const [baselineFamily, setBaselineFamily] = useState((alternateClientEmail || '').trim().toLowerCase());
  const [teamEmails, setTeamEmails] = useState<TeamEmails | null>(null);
  const [teamEmailsLoaded, setTeamEmailsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setPrimary((clientEmail || '').trim());
    setFamilyEmail((alternateClientEmail || '').trim());
  }, [clientEmail, alternateClientEmail]);

  useEffect(() => {
    if (!sessionId) {
      setTeamEmailsLoaded(true);
      return;
    }
    fetch(`${API}/api/auth/team-emails`, { headers: { Authorization: `Bearer ${sessionId}` } })
      .then(async (res) => {
        const text = await res.text();
        if (!res.ok || !text) return null;
        try { return JSON.parse(text); } catch { return null; }
      })
      .then((data) => {
        setTeamEmails(data || null);
        setTeamEmailsLoaded(true);
      })
      .catch(() => {
        setTeamEmailsLoaded(true);
      });
  }, [sessionId]);

  const normalizeEmail = (raw: string) => {
    const t = (raw || '').trim().toLowerCase();
    return t && t.includes('@') ? t : '';
  };

  const isValidEmail = (v: string) => {
    const t = v.trim();
    if (!t) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  };

  const uniqueMembers = (members: TeamMemberEmail[]) => {
    const seen = new Set<string>();
    const out: TeamMemberEmail[] = [];
    members.forEach((m) => {
      const email = normalizeEmail(m.email);
      if (!email || seen.has(email)) return;
      seen.add(email);
      out.push({ ...m, email });
    });
    return out;
  };

  const filterByExpectedEmail = (members: TeamMemberEmail[], expectedEmail?: string) => {
    const expected = normalizeEmail(expectedEmail || '');
    if (!expected) return [];
    const matched = uniqueMembers(members).filter((m) => normalizeEmail(m.email) === expected);
    if (matched.length > 0) return matched;
    return [{ name: expected.split('@')[0], email: expected }];
  };

  const designerEmailNorm = normalizeEmail(designerEmail);
  const adminsForLoop = uniqueMembers(teamEmails?.admins || []).filter(
    (m) => normalizeEmail(m.email) !== designerEmailNorm,
  );
  const tdmForLoop = uniqueMembers(teamEmails?.territorial_design_managers || []).filter(
    (m) => normalizeEmail(m.email) !== designerEmailNorm,
  );
  const dmForLoop = filterByExpectedEmail(
    (teamEmails?.design_managers || []).filter((m) => normalizeEmail(m.email) !== designerEmailNorm),
    designManagerEmail,
  );

  const displayClient = normalizeEmail(primary) || normalizeEmail(clientEmail);
  const displayFamily = normalizeEmail(familyEmail) || normalizeEmail(alternateClientEmail);

  const saveEmails = async (): Promise<{
    ok: boolean;
    clientEmail: string | null;
    alternateClientEmail: string | null;
  } | null> => {
    if (!sessionId || !leadId) {
      setMessage('Not signed in or lead missing.');
      return null;
    }
    if (!isValidEmail(primary) || !isValidEmail(familyEmail)) {
      setMessage('Enter a valid email address.');
      return null;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/api/leads/${leadId}/client-emails`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({
          clientEmail: primary.trim() || null,
          alternateClientEmail: familyEmail.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Save failed');
      const next = {
        clientEmail: (data.clientEmail ?? null) as string | null,
        alternateClientEmail: (data.alternateClientEmail ?? null) as string | null,
      };
      setPrimary((next.clientEmail ?? '').trim());
      setFamilyEmail((next.alternateClientEmail ?? '').trim());
      onEmailsSaved?.(next);
      return { ok: true, ...next };
    } catch (e) {
      setMessage((e as Error).message || 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const buildChangeToast = (saved: {
    clientEmail: string | null;
    alternateClientEmail: string | null;
  }) => {
    const nextPrimary = (saved.clientEmail || '').trim().toLowerCase();
    const nextFamily = (saved.alternateClientEmail || '').trim().toLowerCase();
    const added: string[] = [];
    if (nextPrimary && nextPrimary !== baselinePrimary) {
      added.push(saved.clientEmail!.trim());
    }
    if (nextFamily && nextFamily !== baselineFamily) {
      added.push(saved.alternateClientEmail!.trim());
    }
    if (added.length === 0) {
      return 'No mail changes in mail loop.';
    }
    return `New mail added to mail loop: ${added.join(', ')}`;
  };

  const handleSave = async () => {
    const saved = await saveEmails();
    if (!saved) return;
    setToast(buildChangeToast(saved));
    setBaselinePrimary((saved.clientEmail || '').trim().toLowerCase());
    setBaselineFamily((saved.alternateClientEmail || '').trim().toLowerCase());
    setTimeout(() => setToast(null), 2000);
  };

  const handleMarkComplete = async () => {
    const saved = await saveEmails();
    if (!saved) return;
    onMarkComplete();
    onClose();
  };

  const renderRow = (email: string, name?: string) => (
    <div className="flex items-center gap-2">
      <span className="flex-1 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm">
        {name ? `${name} · ${email}` : email || '—'}
      </span>
    </div>
  );

  const renderRoleSection = (title: string, members: TeamMemberEmail[]) => {
    if (!members.length) return null;
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{title}</label>
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={`${title}-${i}`}>{renderRow(m.email, m.name)}</div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="px-6 pb-6">
      <p className="text-gray-600 text-sm mb-4">
        Verify mail loop members below. Add or update client email and optionally one family member.
        New addresses join the design-journey mail loop.
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client email (To)</label>
          {renderRow(displayClient || '—')}
        </div>
        {displayFamily ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Family member (To)</label>
            {renderRow(displayFamily)}
          </div>
        ) : null}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Designer email (CC)</label>
          {renderRow(designerEmail || '—')}
        </div>
        {!teamEmailsLoaded && (
          <p className="text-sm text-gray-500 italic">Loading admin, TDM, DM emails…</p>
        )}
        {teamEmailsLoaded && teamEmails && (
          <>
            {renderRoleSection('Admin(s) (CC)', adminsForLoop)}
            {renderRoleSection('Territorial Design Manager(s) (CC)', tdmForLoop)}
            {renderRoleSection('Design Manager(s) (CC)', dmForLoop)}
          </>
        )}
        <p className="text-xs text-gray-500">
          <strong>To:</strong> Client (+ family if added) · <strong>CC:</strong> Designer, Admin(s), TDM(s), DM
        </p>
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-4">
        <p className="text-sm font-medium text-gray-800">Add / update emails</p>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Client email</span>
          <input
            type="email"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            placeholder="client@example.com"
            autoComplete="email"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Family member email <span className="font-normal text-gray-500">(one only, optional)</span>
          </span>
          <input
            type="email"
            value={familyEmail}
            onChange={(e) => setFamilyEmail(e.target.value)}
            placeholder="family@example.com"
            autoComplete="email"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none"
          />
        </label>
        {message && <p className="text-sm font-medium text-red-600">{message}</p>}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !sessionId || !leadId || !!toast}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save emails'}
        </button>
        <button
          type="button"
          onClick={handleMarkComplete}
          disabled={saving || !sessionId || !leadId}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Mark as done'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          Close
        </button>
      </div>

      {toast && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white text-base font-medium px-8 py-4 rounded-lg shadow-2xl z-[9999] text-center max-w-md">
          {toast}
        </div>
      )}
    </div>
  );
}
