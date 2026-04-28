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
  /** Used as “To” when primary is empty */
  alternateClientEmail?: string;
  designerEmail: string;
  projectPid?: string;
  projectName?: string;
  designManagerEmail?: string;
  tdmEmail?: string;
  sessionId: string | null;
  onMarkComplete: () => void;
  onClose: () => void;
};

/**
 * Task: Mail loop chain 2 initiate — create email chain with client, designer, TDM, DM, admin.
 */
export default function PopupMailLoopChain({
  leadId,
  clientEmail,
  alternateClientEmail = '',
  designerEmail,
  projectPid,
  projectName,
  designManagerEmail = '',
  tdmEmail = '',
  sessionId,
  onMarkComplete,
  onClose,
}: Props) {
  const [teamEmails, setTeamEmails] = useState<TeamEmails | null>(null);
  const [teamEmailsLoaded, setTeamEmailsLoaded] = useState(true);
  const [copyStatus, setCopyStatus] = useState<string>('');
  const [isSendingChain, setIsSendingChain] = useState(false);

  useEffect(() => {
    if (!sessionId) {
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

  // To: client only (email goes from designer to client). CC: designer, admin, TDM, DM.
  const toEmails = (): string[] => {
    const primary = normalizeEmail(clientEmail);
    if (primary) return [primary];
    const alt = normalizeEmail(alternateClientEmail);
    return alt ? [alt] : [];
  };
  const ccEmails = (): string[] => {
    const set = new Set<string>();
    const add = (e: string) => {
      const t = normalizeEmail(e);
      if (t) set.add(t);
    };
    add(designerEmail);
    adminsForLoop.forEach((m) => add(m.email));
    tdmForLoop.forEach((m) => add(m.email));
    dmForLoop.forEach((m) => add(m.email));
    return Array.from(set);
  };

  const toList = toEmails();
  const ccList = ccEmails();
  const subject = projectPid || projectName
    ? `Project ${projectPid || ''} ${projectName || ''} – Design discussion`.trim()
    : 'Design discussion – Mail chain';
  const gmailInboxUrl = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(subject)}`;

  const triggerMailChain = async (openGmailInbox = false) => {
    if (!sessionId || !leadId || toList.length === 0 || isSendingChain) return;
    setIsSendingChain(true);
    setCopyStatus('');
    try {
      const resp = await fetch(`${API}/api/leads/${leadId}/mail-loop-chain-initiate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(txt || `HTTP ${resp.status}`);
      }
      setCopyStatus('Mail chain sent via communication@hubinterior.com');
      if (openGmailInbox) {
        window.open(gmailInboxUrl, '_blank', 'noopener,noreferrer');
      }
      setTimeout(() => setCopyStatus(''), 2500);
    } catch {
      setCopyStatus('Mail send failed. Please retry.');
      setTimeout(() => setCopyStatus(''), 3000);
    } finally {
      setIsSendingChain(false);
    }
  };

  const copyDraft = async () => {
    const draftText = [
      `To: ${toList.join(', ') || '-'}`,
      `CC: ${ccList.join(', ') || '-'}`,
      `Subject: ${subject}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(draftText);
      setCopyStatus('Copied To/CC/Subject.');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch {
      setCopyStatus('Copy failed. Please copy manually.');
      setTimeout(() => setCopyStatus(''), 2500);
    }
  };

  const renderRow = (label: string, email: string, name?: string) => (
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
            <div key={`${title}-${i}`}>{renderRow('', m.email, m.name)}</div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="px-6 pb-6">
      <p className="text-gray-600 text-sm mb-4">
        Start the mail chain from designer (you) to client. Client is in <strong>To</strong>; designer, admin, TDM, and DM are in <strong>CC</strong>.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client email (primary)</label>
          {renderRow('', clientEmail)}
          {alternateClientEmail?.trim() && (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">Alternate client email</label>
              {renderRow('', alternateClientEmail)}
            </>
          )}
          {!clientEmail?.trim() && !alternateClientEmail?.trim() && (
            <p className="text-xs text-amber-600 mt-1">
              No client email yet. Ask your manager to add a primary or alternate on the lead page.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Designer email (you)</label>
          {renderRow('', designerEmail)}
        </div>
        {!teamEmailsLoaded && (
          <p className="text-sm text-gray-500 italic">Loading admin, TDM, DM emails…</p>
        )}
        {teamEmailsLoaded && teamEmails && (
          <>
            {renderRoleSection('Admin(s)', adminsForLoop)}
            {renderRoleSection('Territorial Design Manager(s)', tdmForLoop)}
            {renderRoleSection('Design Manager(s)', dmForLoop)}
          </>
        )}
      </div>
      <div className="mt-6">
        <p className="text-xs text-gray-500 mb-2">
          <strong>To:</strong> Client · <strong>CC:</strong> Designer (you), Admin(s), TDM(s), DM(s)
        </p>
        <p className="text-xs text-amber-600 mb-2">
          Both actions below send from <code>communication@hubinterior.com</code> via SMTP.
        </p>
        <div className="flex flex-wrap gap-3">
        {toList.length > 0 && teamEmailsLoaded ? (
          <button
            type="button"
            onClick={() => triggerMailChain(false)}
            disabled={isSendingChain}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            {isSendingChain ? 'Sending…' : 'Start email chain'}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium opacity-50 cursor-not-allowed"
          >
            {!teamEmailsLoaded ? 'Loading…' : 'Start email chain'}
          </button>
        )}
        <button
          type="button"
          onClick={() => { onMarkComplete(); onClose(); }}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
        >
          Mark as done
        </button>
        <button
          type="button"
          onClick={() => triggerMailChain(true)}
          disabled={toList.length === 0 || !teamEmailsLoaded || isSendingChain}
          className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium ${toList.length > 0 && teamEmailsLoaded && !isSendingChain ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-600 text-white opacity-50 cursor-not-allowed'}`}
        >
          Open in Gmail
        </button>
        <button
          type="button"
          onClick={copyDraft}
          disabled={toList.length === 0}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Copy draft fields
        </button>
        
        </div>
        {!!copyStatus && <p className="text-xs text-gray-600 mt-2">{copyStatus}</p>}
      </div>
    </div>
  );
}
