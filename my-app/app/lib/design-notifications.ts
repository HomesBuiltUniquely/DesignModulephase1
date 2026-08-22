import { getApiBase, buildAuthHeaders } from './apiBase';

export type DesignNotificationItem = {
  id: number;
  project_id: string;
  lead_id: number | null;
  lead_name: string;
  designer_id: number | null;
  notification_type: string;
  notification_action: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  go_response: unknown;
  response: unknown;
  request: unknown;
};

export type DesignNotificationCounts = {
  total: number;
  by_type: Record<string, number>;
};

export type NotificationDetailRow = { label: string; value: string };

export async function fetchDesignNotifications(
  sessionId: string,
  since?: string,
  limit = 50,
): Promise<DesignNotificationItem[]> {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  params.set('limit', String(limit));
  const res = await fetch(`${getApiBase()}/api/design/notifications?${params}`, {
    headers: buildAuthHeaders(sessionId),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load notifications');
  const json = await res.json();
  return (json?.data ?? []) as DesignNotificationItem[];
}

export async function fetchDesignNotificationWsUrl(sessionId: string): Promise<string | null> {
  const res = await fetch(`${getApiBase()}/api/design/notifications/ws-ticket`, {
    headers: buildAuthHeaders(sessionId),
    credentials: 'include',
  });
  if (!res.ok) return null;
  const json = await res.json();
  const url = json?.data?.ws_url;
  return typeof url === 'string' && url ? url : null;
}

export async function fetchDesignNotificationCounts(
  sessionId: string,
  since?: string,
): Promise<DesignNotificationCounts> {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  const res = await fetch(`${getApiBase()}/api/design/notifications/counts?${params}`, {
    headers: buildAuthHeaders(sessionId),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load notification counts');
  const json = await res.json();
  return (json?.data ?? { total: 0, by_type: {} }) as DesignNotificationCounts;
}

export async function markDesignNotificationRead(sessionId: string, id: number): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/design/notifications/${id}/read`, {
    method: 'POST',
    headers: buildAuthHeaders(sessionId),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to mark notification read');
}

export async function markAllDesignNotificationsRead(sessionId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/design/notifications/read-all`, {
    method: 'POST',
    headers: buildAuthHeaders(sessionId),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to mark notifications read');
}

function str(v: unknown): string {
  if (v == null || v === '') return '';
  return String(v).trim();
}

function pickPayload(item: DesignNotificationItem): Record<string, unknown> {
  const p = item.payload || {};
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (k.startsWith('_')) continue;
    cleaned[k] = v;
  }
  return cleaned;
}

function slotFromPayload(p: Record<string, unknown>): { date: string; time: string } {
  const slot =
    p.slot && typeof p.slot === 'object' && !Array.isArray(p.slot)
      ? (p.slot as Record<string, unknown>)
      : {};
  return {
    date: str(slot.date || p.visit_date || p.date),
    time: str(slot.time_slot || slot.timeSlot || slot.slot_time || p.visit_time || p.time),
  };
}

function humanizeLabel(raw: string): string {
  const s = str(raw).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  // Known meeting type aliases
  const lower = s.toLowerCase();
  if (/dqc1|first.?cut/.test(lower)) return 'First Cut (DQC1)';
  if (/dqc2|sign.?off|signoff/.test(lower)) return 'Design Sign-off';
  if (/material/.test(lower)) return 'Material Selection';
  if (/showroom/.test(lower)) return 'Showroom Visit';
  if (/site.?visit/.test(lower)) return 'Site Visit';
  if (/virtual/.test(lower)) return 'Virtual Meeting';
  // Title-case remaining words
  return s
    .split(' ')
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function actorNameFrom(p: Record<string, unknown>): string {
  return str(
    p.approver_name ||
      p.actor_name ||
      p.assigned_by ||
      p.approved_by ||
      p.approverName ||
      p.actorName,
  );
}

function designerNameFrom(item: DesignNotificationItem, p: Record<string, unknown>): string {
  return str(
    p.designer_name ||
      p.designerName ||
      (item.response && typeof item.response === 'object'
        ? (item.response as Record<string, unknown>).designer_name
        : '') ||
      '',
  );
}

function paymentTypeLabel(raw: string): string {
  const u = str(raw).toUpperCase();
  if (!u) return '';
  if (u === 'SALES_CLOSURE' || u.includes('SALES_CLOSURE') || u === 'CRM_BOOKING') return 'Sales Closure';
  if (u.includes('40')) return '40% payment';
  if (u.includes('10')) return '10% payment';
  return humanizeLabel(raw);
}

function dqcRoundLabel(raw: string): string {
  const u = str(raw).toUpperCase();
  if (!u) return '';
  if (u.includes('2')) return 'DQC 2';
  if (u.includes('1')) return 'DQC 1';
  return humanizeLabel(raw);
}

export function quoteLinkFromNotification(item: DesignNotificationItem): string | null {
  const p = pickPayload(item);
  const link = str(p.quote_link || p.quoteLink || p.quote_url || p.quoteUrl);
  if (link) return link;
  const q = str(p.quote_id || p.quoteId).replace(/^QT-/i, '');
  if (/^\d+$/.test(q)) return `/quote/${q}`;
  return null;
}

export function formatNotificationTitle(item: DesignNotificationItem): string {
  const type = (item.notification_type || '').toUpperCase();
  const action = (item.notification_action || '').toUpperCase();
  const p = pickPayload(item);

  if (type === 'LEAD' && action === 'CREATED') return 'New lead in Pre-10%';
  if (type === 'PHASE') return 'Lead moved to 10–20%';
  if (type === 'MILESTONE') {
    const name = humanizeLabel(String(p.milestone_name || p.milestoneName || '')) || 'Milestone';
    return `${name} completed`;
  }
  if (type === 'PAYMENT') {
    const payType = str(p.payment_type || p.paymentType).toUpperCase();
    const ctx = str(p.milestone_context || p.milestoneContext).toUpperCase();
    const isSalesClosure =
      payType === 'SALES_CLOSURE' ||
      ctx === 'SALES_CLOSURE' ||
      ctx === 'CRM_BOOKING';
    if (action === 'REQUESTED') {
      if (isSalesClosure) return 'Sales Closure payment requested';
      if (payType.includes('40')) return '40% payment requested';
      if (payType.includes('10')) return '10% payment requested';
      return 'Payment requested';
    }
    if (action.includes('REJECT')) {
      if (isSalesClosure) return 'Sales Closure payment rejected';
      if (payType.includes('40')) return '40% payment rejected';
      if (payType.includes('10')) return '10% payment rejected';
      return 'Payment rejected';
    }
    if (isSalesClosure) return 'Sales Closure payment approved';
    if (payType.includes('40')) return '40% payment approved';
    if (payType.includes('10')) return '10% payment approved';
    return 'Payment approved';
  }
  if (type === 'DQC' && action === 'REQUESTED') return 'DQC review needed';
  if (type === 'DQC' && action.includes('REJECT')) return 'DQC rejected';
  if (type === 'DQC') return 'DQC approved';
  if (type === 'MMT' && action === 'DOCUMENTS_READY') return 'MMT documents ready';
  if (type === 'ASSIGNMENT' && action === 'ASSIGNED') return 'MMT executive assigned';
  if (type === 'MMT') return 'MMT visit requested';
  if (type === 'MEETING') {
    const mt = humanizeLabel(String(p.meeting_type || p.meetingType || ''));
    return mt ? `${mt} scheduled` : 'Meeting scheduled';
  }
  if (type === 'ASSIGNMENT' && action.includes('PM')) return 'Project Manager assigned';
  if (type === 'ASSIGNMENT') return 'Designer reassigned';
  if (type === 'QUOTE') return 'New quote created';
  if (type === 'PM' && action.includes('REJECT')) return 'PM rejected DQC 2';
  if (type === 'PM') return 'PM approved DQC 2';
  if (type === 'P2P') {
    const designer = designerNameFrom(item, p);
    return designer
      ? `Congratulate ${designer} — lead completed successfully`
      : 'Lead completed — congratulations';
  }
  return `${type} ${action}`.trim();
}

/** Subtitle = only fields from that API's response (01–15). */
export function formatNotificationSubtitle(item: DesignNotificationItem): string {
  const p = pickPayload(item);
  const type = (item.notification_type || '').toUpperCase();
  const action = (item.notification_action || '').toUpperCase();
  const parts: string[] = [];
  const push = (v: unknown) => {
    const s = str(v);
    if (s && !parts.includes(s)) parts.push(s);
  };
  const slot = slotFromPayload(p);

  // Root response on every API: lead_name, project_id
  push(item.lead_name);
  push(item.project_id);

  if (type === 'LEAD') {
    // API 01: current_phase, designer_name, sales_executive_name, slot, meeting_type
    push(humanizeLabel(String(p.current_phase || 'PRE_10')));
    const designer = designerNameFrom(item, p);
    if (designer) push(`Designer: ${designer}`);
    const sales = str(p.sales_executive_name || p.salesExecutiveName);
    if (sales) push(`Sales: ${sales}`);
    const mt = humanizeLabel(String(p.meeting_type || p.meetingType || ''));
    if (mt) push(mt);
    if (slot.date || slot.time) push([slot.date, slot.time].filter(Boolean).join(' '));
  } else if (type === 'PHASE') {
    // API 02: phase, previous_phase, trigger, message
    push(humanizeLabel(String(p.phase || 'PHASE_10_20')));
    const prev = humanizeLabel(String(p.previous_phase || ''));
    if (prev) push(`From ${prev}`);
    push(humanizeLabel(String(p.trigger || '')));
    push(p.message);
  } else if (type === 'MILESTONE') {
    // API 03: fires when every task in the milestone is done
    push(humanizeLabel(String(p.milestone_name || p.milestoneName || '')));
    const designer = designerNameFrom(item, p);
    if (designer) push(`Designer: ${designer}`);
  } else if (type === 'PAYMENT' && action === 'REQUESTED') {
    const pay = paymentTypeLabel(String(p.payment_type || p.paymentType || ''));
    if (pay) push(pay);
    push(p.upload_name || p.uploadName);
    if (p.amount != null && p.amount !== '') push(`₹${p.amount}`);
    const designer = designerNameFrom(item, p);
    if (designer) push(`Designer: ${designer}`);
  } else if (type === 'PAYMENT') {
    const pay = paymentTypeLabel(String(p.payment_type || p.paymentType || ''));
    if (pay) push(pay);
    const designer = designerNameFrom(item, p);
    if (designer) push(`Designer: ${designer}`);
    const approver = actorNameFrom(p);
    if (approver) push(`By: ${approver}`);
    if (p.amount != null && p.amount !== '') push(`₹${p.amount}`);
    const reason = str(p.rejection_reason || p.rejectionReason);
    if (reason) push(`Reason: ${reason}`);
  } else if (type === 'DQC' && action === 'REQUESTED') {
    const round = dqcRoundLabel(String(p.dqc_round || p.dqcRound || ''));
    if (round) push(round);
    const designer = designerNameFrom(item, p);
    if (designer) push(`Designer: ${designer}`);
  } else if (type === 'DQC') {
    const round = dqcRoundLabel(String(p.dqc_round || p.dqcRound || ''));
    if (round) push(round);
    const designer = designerNameFrom(item, p);
    if (designer) push(`Designer: ${designer}`);
    const approver = actorNameFrom(p);
    if (approver) push(`By: ${approver}`);
    const reason = str(p.rejection_reason || p.rejectionReason);
    if (reason) push(`Reason: ${reason}`);
  } else if (type === 'MMT' && action === 'DOCUMENTS_READY') {
    // API 10: mmt_scope, via, upload_name, approved_by
    push(humanizeLabel(String(p.mmt_scope || p.mmtScope || '')));
    push(humanizeLabel(String(p.via || '')));
    push(p.upload_name || p.uploadName);
    const approvedBy = str(p.approved_by || p.approvedBy);
    if (approvedBy) push(`Approved by: ${approvedBy}`);
  } else if (type === 'MMT') {
    // API 08: mmt_scope, visit_date, visit_time, mmt_manager_name, designer_name
    push(humanizeLabel(String(p.mmt_scope || p.mmtScope || '')));
    const visit = [str(p.visit_date || p.visitDate), str(p.visit_time || p.visitTime)].filter(Boolean).join(' ');
    if (visit) push(visit);
    const mgr = str(p.mmt_manager_name || p.mmtManagerName);
    if (mgr) push(`MMT Mgr: ${mgr}`);
    const designer = designerNameFrom(item, p);
    if (designer) push(`Designer: ${designer}`);
  } else if (type === 'MEETING') {
    // API 11: meeting_type, mod, slot.date, slot.time_slot
    push(humanizeLabel(String(p.meeting_type || p.meetingType || '')));
    push(humanizeLabel(String(p.mod || p.mode || p.meeting_mode || '')));
    if (slot.date) push(slot.date);
    if (slot.time) push(slot.time);
  } else if (type === 'ASSIGNMENT' && action === 'ASSIGNED') {
    // API 09: assignment_type, to_name, designer, who assigned
    push(humanizeLabel(String(p.assignment_type || p.assignmentType || '')));
    const to = str(p.to_name || p.toName);
    if (to) push(`→ ${to}`);
    const designer = designerNameFrom(item, p);
    if (designer) push(`Designer: ${designer}`);
    const actor = actorNameFrom(p);
    if (actor) push(`By: ${actor}`);
  } else if (type === 'ASSIGNMENT' && action.includes('PM')) {
    // API 13: assignment_type, to_name
    push(humanizeLabel(String(p.assignment_type || p.assignmentType || 'PROJECT MANAGER')));
    const to = str(p.to_name || p.toName);
    if (to) push(`→ ${to}`);
  } else if (type === 'ASSIGNMENT') {
    // API 12: assignment_type, from_name, to_name
    push(humanizeLabel(String(p.assignment_type || p.assignmentType || '')));
    const from = str(p.from_name || p.fromName);
    const to = str(p.to_name || p.toName);
    if (from && to) push(`${from} → ${to}`);
    else if (to) push(`→ ${to}`);
  } else if (type === 'QUOTE') {
    const q = str(p.quote_id || p.quoteId);
    if (q) push(`Quote ${q}`);
  } else if (type === 'PM') {
    push('DQC 2');
    const designer = designerNameFrom(item, p);
    if (designer) push(`Designer: ${designer}`);
    const actor = actorNameFrom(p);
    if (actor) push(`By: ${actor}`);
    const reason = str(p.rejection_reason || p.rejectionReason);
    if (reason) push(`Reason: ${reason}`);
  } else if (type === 'P2P') {
    const designer = designerNameFrom(item, p);
    if (designer) push(`Designer: ${designer}`);
    push('Successfully completed this lead');
  }

  return parts.filter(Boolean).join(' • ');
}

export function notificationCategoryLabel(type: string): string {
  const t = (type || '').toUpperCase();
  const map: Record<string, string> = {
    LEAD: 'Lead',
    PHASE: 'Phase',
    MILESTONE: 'Milestone',
    PAYMENT: 'Payment',
    DQC: 'DQC',
    MMT: 'MMT',
    MEETING: 'Meeting',
    ASSIGNMENT: 'Assignment',
    QUOTE: 'Quote',
    P2P: 'P2P',
    PM: 'PM',
  };
  return map[t] || t || 'Other';
}

export function notificationCategoryTone(type: string): {
  iconBg: string;
  iconText: string;
  tagBg: string;
  tagText: string;
} {
  const t = (type || '').toUpperCase();
  switch (t) {
    case 'MEETING':
      return { iconBg: 'bg-emerald-100', iconText: 'text-emerald-700', tagBg: 'bg-blue-50', tagText: 'text-blue-700' };
    case 'PAYMENT':
      return { iconBg: 'bg-orange-100', iconText: 'text-orange-700', tagBg: 'bg-orange-50', tagText: 'text-orange-700' };
    case 'MILESTONE':
    case 'P2P':
      return { iconBg: 'bg-violet-100', iconText: 'text-violet-700', tagBg: 'bg-violet-50', tagText: 'text-violet-700' };
    case 'LEAD':
    case 'PHASE':
      return { iconBg: 'bg-sky-100', iconText: 'text-sky-700', tagBg: 'bg-sky-50', tagText: 'text-sky-700' };
    case 'DQC':
    case 'PM':
      return { iconBg: 'bg-teal-100', iconText: 'text-teal-700', tagBg: 'bg-teal-50', tagText: 'text-teal-700' };
    case 'MMT':
      return { iconBg: 'bg-amber-100', iconText: 'text-amber-800', tagBg: 'bg-amber-50', tagText: 'text-amber-800' };
    case 'ASSIGNMENT':
      return { iconBg: 'bg-rose-100', iconText: 'text-rose-700', tagBg: 'bg-rose-50', tagText: 'text-rose-700' };
    case 'QUOTE':
      return { iconBg: 'bg-indigo-100', iconText: 'text-indigo-700', tagBg: 'bg-indigo-50', tagText: 'text-indigo-700' };
    default:
      return { iconBg: 'bg-gray-100', iconText: 'text-gray-600', tagBg: 'bg-gray-50', tagText: 'text-gray-600' };
  }
}

export type DayGroup = { key: string; label: string; items: DesignNotificationItem[] };

export function groupNotificationsByDay(items: DesignNotificationItem[]): DayGroup[] {
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const today = startOfDay(new Date());
  const yesterday = today - 24 * 60 * 60 * 1000;
  const buckets: Record<string, DesignNotificationItem[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const item of items) {
    const t = startOfDay(new Date(item.created_at));
    if (t === today) buckets.today.push(item);
    else if (t === yesterday) buckets.yesterday.push(item);
    else buckets.earlier.push(item);
  }
  const out: DayGroup[] = [];
  if (buckets.today.length) out.push({ key: 'today', label: 'TODAY', items: buckets.today });
  if (buckets.yesterday.length) out.push({ key: 'yesterday', label: 'YESTERDAY', items: buckets.yesterday });
  if (buckets.earlier.length) out.push({ key: 'earlier', label: 'EARLIER', items: buckets.earlier });
  return out;
}

/** Human-readable detail rows (kept for optional detail views). */
export function getNotificationDetailRows(item: DesignNotificationItem): NotificationDetailRow[] {
  const p = pickPayload(item);
  const type = (item.notification_type || '').toUpperCase();
  const rows: NotificationDetailRow[] = [
    { label: 'Project', value: item.project_id || '—' },
    { label: 'Lead', value: item.lead_name || '—' },
  ];

  const push = (label: string, value: unknown) => {
    const v = str(value);
    if (v) rows.push({ label, value: v });
  };

  if (type === 'MEETING') {
    const slot = slotFromPayload(p);
    push('Meeting type', p.meeting_type || p.meetingType);
    push('Mode', p.mod || p.mode || p.meeting_mode);
    push('Date', slot.date);
    push('Time', slot.time);
  } else if (type === 'PAYMENT') {
    push('Status', p.status || item.notification_action);
    push('Payment type', p.payment_type || p.paymentType);
    push('Amount', p.amount != null ? String(p.amount) : '');
  }

  return rows;
}

export function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  if (hrs < 48) return 'Yesterday';
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
