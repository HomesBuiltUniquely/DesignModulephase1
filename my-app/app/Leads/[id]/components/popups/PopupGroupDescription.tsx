'use client';

import { useState, useEffect } from 'react';

const API = 'http://localhost:3001';

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

type TeamMember = { name: string; phone: string };

type TeamPhones = {
  admins: TeamMember[];
  territorial_design_managers: TeamMember[];
  design_managers: TeamMember[];
};

type Props = {
  designerPhone: string;
  clientPhone: string;
  sessionId: string | null;
  onMarkComplete: () => void;
  onClose: () => void;
};

/**
 * Milestone 1 first task: Create WhatsApp group — designer, client, admin, TDM, DMs.
 */
export default function PopupGroupDescription({ designerPhone, clientPhone, sessionId, onMarkComplete, onClose }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [teamPhones, setTeamPhones] = useState<TeamPhones | null>(null);
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

  const allPhonesWithRole = (): { role: string; name: string; phone: string }[] => {
    const list: { role: string; name: string; phone: string }[] = [];
    if (hasDesigner) list.push({ role: 'Designer', name: 'You', phone: designerPhone });
    if (hasClient) list.push({ role: 'Client', name: 'Client', phone: clientPhone });
    (teamPhones?.admins || []).forEach((m) => { if ((m.phone || '').replace(/\D/g, '').length >= 10) list.push({ role: 'Admin', name: m.name, phone: m.phone }); });
    (teamPhones?.territorial_design_managers || []).forEach((m) => { if ((m.phone || '').replace(/\D/g, '').length >= 10) list.push({ role: 'TDM', name: m.name, phone: m.phone }); });
    (teamPhones?.design_managers || []).forEach((m) => { if ((m.phone || '').replace(/\D/g, '').length >= 10) list.push({ role: 'DM', name: m.name, phone: m.phone }); });
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
                className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 flex items-center gap-1.5"
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
        {renderRoleSection('Territorial Design Manager(s)', teamPhones?.territorial_design_managers || [], 'tdm')}
        {renderRoleSection('Design Manager(s)', teamPhones?.design_managers || [], 'dm')}
        <div className="pt-2">
          <button
            type="button"
            onClick={copyAllNumbers}
            disabled={allPhonesWithRole().length === 0}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copiedId === 'all' ? 'Copied all numbers' : 'Copy all numbers (for WhatsApp group)'}
          </button>
          <p className="text-xs text-gray-500 mt-1">Paste elsewhere or use when adding participants to the group.</p>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => { onMarkComplete(); onClose(); }}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
        >
          Mark as done
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}
