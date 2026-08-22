'use client';

import { useState, useEffect, useRef } from 'react';

import { getApiBase } from '@/app/lib/apiBase';
const API = getApiBase();

function toWhatsAppNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10 && !digits.startsWith('0')) return '91' + digits; // India
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits || '';
}

function formatPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits}`;
  return phone || '—';
}

type TeamMember = { name: string; phone: string; email?: string };

type TeamPhones = {
  admins: TeamMember[];
  territorial_design_managers: TeamMember[];
  design_managers: TeamMember[];
};

type Props = {
  leadId?: number | null;
  designerPhone: string;
  clientPhone: string;
  designManagerName?: string;
  designManagerEmail?: string;
  sessionId: string | null;
  /** Returns API result so popup can show mail-success toast */
  onMarkComplete: () => Promise<{ ok: boolean; mailSent?: boolean; mailTo?: string[] }>;
  onClose: () => void;
};

/**
 * Milestone 1 first task: Create WhatsApp group — designer, client, admin, TDM, DMs.
 * Mark as done starts the mail loop and shows a 3s success toast.
 */
export default function PopupGroupDescription({
  leadId,
  designerPhone,
  clientPhone,
  designManagerName = '',
  designManagerEmail = '',
  sessionId,
  onMarkComplete,
  onClose,
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [teamPhones, setTeamPhones] = useState<TeamPhones | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const designerDigits = (designerPhone || '').replace(/\D/g, '');
  const clientDigits = (clientPhone || '').replace(/\D/g, '');
  const whatsappClient = toWhatsAppNumber(clientPhone);
  const hasClient = whatsappClient.length >= 10;
  const hasDesigner = designerDigits.length >= 10;

  useEffect(() => {
    if (!sessionId) return;
    fetch(`${API}/api/auth/team-phones`, { headers: { Authorization: `Bearer ${sessionId}` } })
      .then(async (res) => {
        const text = await res.text();
        if (!res.ok || !text) return null;
        try { return JSON.parse(text); } catch { return null; }
      })
      .then((data) => data && setTeamPhones(data))
      .catch(() => {});
  }, [sessionId]);

  const openWhatsAppWithClient = () => {
    if (!hasClient) return;
    window.open(`https://wa.me/${whatsappClient}`, '_blank', 'noopener,noreferrer');
  };

  const copyNumber = async (phone: string, id: string) => {
    const digits = (phone || '').replace(/\D/g, '');
    const toCopy = digits.length === 10 ? `+91 ${digits}` : phone;
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  const filterAssignedDM = (members: TeamMember[]) => {
    const expectedName = (designManagerName || '').trim().toLowerCase();
    const expectedEmail = (designManagerEmail || '').trim().toLowerCase();
    if (!expectedName && !expectedEmail) return [];

    const matched = members.filter((m) => {
      if (expectedEmail && m.email && m.email.trim().toLowerCase() === expectedEmail) return true;
      if (expectedName) {
        const mName = (m.name || '').trim().toLowerCase();
        if (mName && (mName === expectedName || mName.includes(expectedName) || expectedName.includes(mName))) {
          return true;
        }
      }
      return false;
    });

    if (matched.length > 0) return matched;
    if (designManagerName || designManagerEmail) {
      return [{ name: (designManagerName || designManagerEmail || '').trim(), phone: '' }];
    }
    return [];
  };

  const dmForGroup = filterAssignedDM(teamPhones?.design_managers || []);

  const allPhonesWithRole = (): { role: string; name: string; phone: string }[] => {
    const list: { role: string; name: string; phone: string }[] = [];
    if (hasDesigner) list.push({ role: 'Designer', name: 'You', phone: designerPhone });
    if (hasClient) list.push({ role: 'Client', name: 'Client', phone: clientPhone });
    (teamPhones?.admins || []).forEach((m) => { if ((m.phone || '').replace(/\D/g, '').length >= 10) list.push({ role: 'Admin', name: m.name, phone: m.phone }); });
    (teamPhones?.territorial_design_managers || []).forEach((m) => { if ((m.phone || '').replace(/\D/g, '').length >= 10) list.push({ role: 'TDM', name: m.name, phone: m.phone }); });
    dmForGroup.forEach((m) => { if ((m.phone || '').replace(/\D/g, '').length >= 10) list.push({ role: 'DM', name: m.name, phone: m.phone }); });
    return list;
  };

  const copyAllNumbers = async () => {
    const list = allPhonesWithRole();
    const lines = list.map((p) => `${p.role}: ${p.name} – ${formatPhone(p.phone)}`);
    const text = ['WhatsApp group – add these numbers:', '', ...lines].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId('all');
      setTimeout(() => setCopiedId(null), 2500);
    } catch (_) {}
  };

  const handleMarkDone = async () => {
    if (submittingRef.current || isSubmitting || !leadId) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await onMarkComplete();
      if (!result?.ok) {
        setError('Could not complete task. Please retry.');
        submittingRef.current = false;
        return;
      }
      if (result.mailSent) {
        setToast('Mail loop chain is created and welcome mail sent successfully to client.');
      } else {
        setToast('Task completed. Welcome mail could not be sent — check client email on the lead.');
      }
      setTimeout(() => {
        setToast(null);
        onClose();
      }, 3000);
    } catch {
      setError('Could not complete task. Please retry.');
      submittingRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRoleSection = (title: string, members: TeamMember[], prefix: string) => {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{title}</label>
        {members.length ? (
          <div className="space-y-2">
            {members.map((m, i) => {
              const hasPhone = (m.phone || '').replace(/\D/g, '').length >= 10;
              return (
                <div key={`${prefix}-${i}`} className="flex items-center gap-2">
                  <span className="flex-1 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm">
                    {m.name} {hasPhone ? `· ${formatPhone(m.phone)}` : '· —'}
                  </span>
                  {hasPhone && (
                    <button
                      type="button"
                      onClick={() => copyNumber(m.phone, `${prefix}-${i}`)}
                      className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 shrink-0"
                    >
                      {copiedId === `${prefix}-${i}` ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic py-1">No {title.toLowerCase()} with phone in the system. Create via Admin Panel and add phone in Profile.</p>
        )}
      </div>
    );
  };

  return (
    <div className="px-6 pb-6">
      <p className="text-gray-600 text-sm mb-4">
        Create a WhatsApp group for this project. Add the designer (you), client, admin, TDM, and DMs. Open a chat with the client, then add the rest to create the group.
      </p>
      <p className="text-amber-700 text-xs mb-4 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        Marking as done <strong>starts the mail loop</strong>: client email from the lead goes in{" "}
        <strong>To</strong>; CC includes all admins, all TDMs, and this designer’s design manager.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Designer number (from profile)</label>
          <div className="flex items-center gap-2">
            <span className="flex-1 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 font-mono">
              {hasDesigner ? formatPhone(designerPhone) : designerPhone || '—'}
            </span>
            {hasDesigner && (
              <button
                type="button"
                onClick={() => copyNumber(designerPhone, 'designer')}
                className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
              >
                {copiedId === 'designer' ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          {!hasDesigner && (
            <p className="text-xs text-amber-600 mt-1">Add your phone number in Settings → Profile to use this.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client number (from sales closure)</label>
          <div className="flex items-center gap-2">
            <span className="flex-1 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 font-mono">
              {clientDigits ? formatPhone(clientPhone) : '—'}
            </span>
            {hasClient && (
              <button
                type="button"
                onClick={openWhatsAppWithClient}
                className="px-3 py-2 rounded-lg bg-[#EF0101] text-white text-sm font-medium hover:bg-[#EF0101] flex items-center gap-1.5"
              >
                Open WhatsApp
              </button>
            )}
          </div>
          {!clientDigits && (
            <p className="text-xs text-amber-600 mt-1">Client contact is set from the sales closure form for this lead.</p>
          )}
        </div>
        {renderRoleSection('Admin(s)', teamPhones?.admins || [], 'admin')}
        {renderRoleSection('Territory Design Manager(s)', teamPhones?.territorial_design_managers || [], 'tdm')}
        {renderRoleSection('Design Manager(s)', dmForGroup, 'dm')}
        <div className="pt-2">
          <button
            type="button"
            onClick={copyAllNumbers}
            disabled={allPhonesWithRole().length === 0}
            className="px-4 py-2 rounded-lg bg-[#EF0101] text-white text-sm font-medium hover:bg-[#EF0101] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copiedId === 'all' ? 'Copied all numbers' : 'Copy all numbers (for WhatsApp group)'}
          </button>
          <p className="text-xs text-gray-500 mt-1">Paste elsewhere or use when adding participants to the group.</p>
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={isSubmitting || !leadId}
          className="px-4 py-2 bg-[#EF0101] text-white text-sm font-medium rounded-lg hover:bg-[#EF0101] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Sending…' : 'Mark as done'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
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
