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
  clientEmail: string;
  designerEmail: string;
  projectPid?: string;
  projectName?: string;
  sessionId: string | null;
  onMarkComplete: () => void;
  onClose: () => void;
};

/**
 * Task: Mail loop chain 2 initiate — create email chain with client, designer, TDM, DM, admin.
 */
export default function PopupMailLoopChain({
  clientEmail,
  designerEmail,
  projectPid,
  projectName,
  sessionId,
  onMarkComplete,
  onClose,
}: Props) {
  const [teamEmails, setTeamEmails] = useState<TeamEmails | null>(null);
  const [teamEmailsLoaded, setTeamEmailsLoaded] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setTeamEmailsLoaded(true);
      return;
    }
    setTeamEmailsLoaded(false);
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

  // To: client only (email goes from designer to client). CC: designer, admin, TDM, DM.
  const toEmails = (): string[] => {
    const t = (clientEmail || '').trim().toLowerCase();
    return t && t.includes('@') ? [t] : [];
  };
  const ccEmails = (): string[] => {
    const set = new Set<string>();
    const add = (e: string) => {
      const t = (e || '').trim().toLowerCase();
      if (t && t.includes('@')) set.add(t);
    };
    add(designerEmail);
    (teamEmails?.admins || []).forEach((m) => add(m.email));
    (teamEmails?.territorial_design_managers || []).forEach((m) => add(m.email));
    (teamEmails?.design_managers || []).forEach((m) => add(m.email));
    return Array.from(set);
  };

  const toList = toEmails();
  const ccList = ccEmails();
  const subject = projectPid || projectName
    ? `Project ${projectPid || ''} ${projectName || ''} – Design discussion`.trim()
    : 'Design discussion – Mail chain';
  // Build cc param: some clients parse multiple addresses better when commas are not encoded
  const ccParam = ccList.length ? ccList.map((e) => encodeURIComponent(e)).join(',') : '';
  const mailtoUrl = toList.length > 0
    ? `mailto:${toList.join(',')}?${ccParam ? `cc=${ccParam}&` : ''}subject=${encodeURIComponent(subject)}`
    : '';

  const openMailChain = () => {
    if (!mailtoUrl) return;
    window.location.href = mailtoUrl;
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Client email (from sales closure)</label>
          {renderRow('', clientEmail)}
          {!clientEmail?.trim() && (
            <p className="text-xs text-amber-600 mt-1">Client email is set from the sales closure form for this lead.</p>
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
            {renderRoleSection('Admin(s)', teamEmails.admins || [])}
            {renderRoleSection('Territorial Design Manager(s)', teamEmails.territorial_design_managers || [])}
            {renderRoleSection('Design Manager(s)', teamEmails.design_managers || [])}
          </>
        )}
      </div>
      <div className="mt-6">
        <p className="text-xs text-gray-500 mb-2">
          <strong>To:</strong> Client · <strong>CC:</strong> Designer (you), Admin(s), TDM(s), DM(s)
        </p>
        <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={openMailChain}
          disabled={toList.length === 0 || !teamEmailsLoaded}
          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!teamEmailsLoaded ? 'Loading…' : 'Start email chain'}
        </button>
        <button
          type="button"
          onClick={() => { onMarkComplete(); onClose(); }}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
        >
          Mark as done
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200">
          Close
        </button>
        </div>
      </div>
    </div>
  );
}
