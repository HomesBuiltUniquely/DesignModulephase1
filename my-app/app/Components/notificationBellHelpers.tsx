import type { ReactNode } from 'react';
import type { DesignNotificationItem } from './DesignNotificationProvider';

export type NotificationDetailRow = { label: string; value: string };

const TYPE_STYLES: Record<string, { badge: string; iconBg: string; iconText: string }> = {
  LEAD: { badge: 'bg-sky-50 text-sky-700', iconBg: 'bg-sky-50', iconText: 'text-sky-600' },
  PHASE: { badge: 'bg-violet-50 text-violet-700', iconBg: 'bg-violet-50', iconText: 'text-violet-600' },
  MILESTONE: { badge: 'bg-indigo-50 text-indigo-700', iconBg: 'bg-indigo-50', iconText: 'text-indigo-600' },
  PAYMENT: { badge: 'bg-emerald-50 text-emerald-700', iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
  DQC: { badge: 'bg-amber-50 text-amber-700', iconBg: 'bg-amber-50', iconText: 'text-amber-600' },
  MMT: { badge: 'bg-cyan-50 text-cyan-700', iconBg: 'bg-cyan-50', iconText: 'text-cyan-600' },
  MEETING: { badge: 'bg-purple-50 text-purple-700', iconBg: 'bg-purple-50', iconText: 'text-purple-600' },
  ASSIGNMENT: { badge: 'bg-orange-50 text-orange-700', iconBg: 'bg-orange-50', iconText: 'text-orange-600' },
  QUOTE: { badge: 'bg-pink-50 text-pink-700', iconBg: 'bg-pink-50', iconText: 'text-pink-600' },
  QUOTATION: { badge: 'bg-pink-50 text-pink-700', iconBg: 'bg-pink-50', iconText: 'text-pink-600' },
  P2P: { badge: 'bg-rose-50 text-rose-700', iconBg: 'bg-rose-50', iconText: 'text-rose-600' },
  PM: { badge: 'bg-teal-50 text-teal-700', iconBg: 'bg-teal-50', iconText: 'text-teal-600' },
};

export function getNotificationTypeStyle(type: string) {
  const key = (type || '').toUpperCase();
  return TYPE_STYLES[key] ?? {
    badge: 'bg-gray-100 text-gray-600',
    iconBg: 'bg-gray-100',
    iconText: 'text-gray-500',
  };
}

/** Category colors for notification list (commit abb595 UI). */
export function notificationCategoryTone(type: string): {
  iconBg: string;
  iconText: string;
  tagBg: string;
  tagText: string;
} {
  const t = (type || '').toUpperCase();
  switch (t) {
    case 'MEETING':
      return {
        iconBg: 'bg-emerald-100',
        iconText: 'text-emerald-700',
        tagBg: 'bg-blue-50',
        tagText: 'text-blue-700',
      };
    case 'PAYMENT':
      return {
        iconBg: 'bg-orange-100',
        iconText: 'text-orange-700',
        tagBg: 'bg-orange-50',
        tagText: 'text-orange-700',
      };
    case 'MILESTONE':
    case 'P2P':
      return {
        iconBg: 'bg-violet-100',
        iconText: 'text-violet-700',
        tagBg: 'bg-violet-50',
        tagText: 'text-violet-700',
      };
    case 'LEAD':
    case 'PHASE':
      return {
        iconBg: 'bg-sky-100',
        iconText: 'text-sky-700',
        tagBg: 'bg-sky-50',
        tagText: 'text-sky-700',
      };
    case 'DQC':
    case 'PM':
      return {
        iconBg: 'bg-teal-100',
        iconText: 'text-teal-700',
        tagBg: 'bg-teal-50',
        tagText: 'text-teal-700',
      };
    case 'MMT':
      return {
        iconBg: 'bg-amber-100',
        iconText: 'text-amber-800',
        tagBg: 'bg-amber-50',
        tagText: 'text-amber-800',
      };
    case 'ASSIGNMENT':
      return {
        iconBg: 'bg-rose-100',
        iconText: 'text-rose-700',
        tagBg: 'bg-rose-50',
        tagText: 'text-rose-700',
      };
    case 'QUOTE':
    case 'QUOTATION':
      return {
        iconBg: 'bg-indigo-100',
        iconText: 'text-indigo-700',
        tagBg: 'bg-indigo-50',
        tagText: 'text-indigo-700',
      };
    default:
      return {
        iconBg: 'bg-gray-100',
        iconText: 'text-gray-600',
        tagBg: 'bg-gray-50',
        tagText: 'text-gray-600',
      };
  }
}

export function quoteLinkFromNotification(item: DesignNotificationItem): string | null {
  const p = asRecord(item.payload);
  const link = pick(p, ['quote_link', 'quoteLink', 'quote_url', 'quoteUrl']);
  if (link) return link;
  const q = pick(p, ['quote_id', 'quoteId']).replace(/^QT-/i, '');
  if (/^\d+$/.test(q)) return `/quote/${q}`;
  return null;
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
    if (!item.created_at) {
      buckets.earlier.push(item);
      continue;
    }
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

export function formatTimeAgo(timeStr?: string): string {
  if (!timeStr) return '';
  const ms = Date.now() - new Date(timeStr).getTime();
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

export function formatActionLabel(action?: string): string {
  if (!action) return 'Update';
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getNotificationHeadline(item: DesignNotificationItem): string {
  const type = (item.notification_type || '').toUpperCase();
  const action = formatActionLabel(item.notification_action);
  const payload = asRecord(item.payload);

  switch (type) {
    case 'LEAD':
      return action === 'Created' ? 'New lead in design pipeline' : `Lead — ${action}`;
    case 'PHASE':
      return payload.message ? String(payload.message) : 'Lead phase changed';
    case 'MILESTONE':
      const task = payload.task_name ? String(payload.task_name) : 'Task';
      return `Milestone update — ${task}`;
    case 'PAYMENT':
      return action.includes('Request')
        ? 'Payment proof submitted for review'
        : `Payment ${payload.decision_type || payload.status || action}`;
    case 'DQC':
      return action.includes('Request')
        ? `DQC review requested (${payload.dqc_round || 'DQC'})`
        : `DQC decision — ${payload.decision_type || payload.status || action}`;
    case 'MMT':
      if (action.includes('Doc')) return 'MMT documents uploaded';
      if (action.includes('Assign')) return 'MMT executive assigned';
      return 'Site measurement requested';
    case 'MEETING':
      return `Meeting scheduled — ${formatMeetingType(payload)}`;
    case 'ASSIGNMENT':
      return action.includes('Designer') ? 'Designer assignment changed' : 'Project manager assigned';
    case 'QUOTE':
    case 'QUOTATION':
      return 'New quotation saved';
    case 'P2P':
      return 'Push to production completed';
    case 'PM':
      return `PM approval — ${payload.status || action}`;
    default:
      return `${type || 'Notification'} — ${action}`;
  }
}

function formatMeetingType(payload: Record<string, unknown>): string {
  const raw = payload.meeting_type || payload.meetingType;
  if (!raw) return 'Design meeting';
  return String(raw).replace(/_/g, ' ');
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  return payload as Record<string, unknown>;
}

function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return '';
}

function formatSlot(slot: unknown): string {
  if (!slot || typeof slot !== 'object') return '';
  const s = slot as Record<string, unknown>;
  const date = pick(s, ['date']);
  const time = pick(s, ['slot_time', 'time_slot', 'time']);
  if (date && time) return `${date} at ${time}`;
  return date || time;
}

export function extractNotificationDetails(item: DesignNotificationItem): NotificationDetailRow[] {
  const payload = asRecord(item.payload);
  const rows: NotificationDetailRow[] = [];

  const add = (label: string, value: string) => {
    if (value) rows.push({ label, value });
  };

  add('Task', pick(payload, ['task_name']));
  add('Milestone', pick(payload, ['milestone_name']));
  add('Designer', pick(payload, ['designer_name']));
  add('Sales executive', pick(payload, ['sales_executive_name']));
  add('Phase', pick(payload, ['current_phase', 'previous_phase']));
  add('Meeting type', formatMeetingType(payload));
  add('Meeting mode', pick(payload, ['mod', 'meeting_mode', 'meetingMode']));
  add('Schedule', formatSlot(payload.slot));
  add('Visit date', pick(payload, ['visit_date']));
  add('Visit time', pick(payload, ['visit_time']));
  add('MMT manager', pick(payload, ['mmt_manager_name']));
  add('Payment stage', pick(payload, ['payment_type', 'milestone_context']));
  add('Decision', pick(payload, ['decision_type', 'status']));
  add('Amount', pick(payload, ['amount']));
  add('Approved by', pick(payload, ['approver_name', 'approved_by']));
  add('DQC round', pick(payload, ['dqc_round']));
  add('Document', pick(payload, ['upload_name']));
  add('From', pick(payload, ['from_name']));
  add('Assigned to', pick(payload, ['to_name']));
  add('Assignment', pick(payload, ['assignment_type']));
  add('Quote ID', pick(payload, ['quote_id', 'quotation_name']));
  add('Note', pick(payload, ['message']));
  add('Reason', pick(payload, ['rejection_reason']));

  if (item.designer_id) add('Designer ID', String(item.designer_id));
  if (item.recipient_role) add('Your role', item.recipient_role.replace(/_/g, ' '));

  return rows;
}

export function getNotificationIcon(type: string): ReactNode {
  const cls = 'w-4 h-4';
  switch (type?.toUpperCase()) {
    case 'LEAD':
    case 'PHASE':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={cls}>
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 1 1 14 0H5Z" />
        </svg>
      );
    case 'MILESTONE':
    case 'P2P':
    case 'PM':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={cls}>
          <path d="M6 3h12v2H6V3Zm0 7h12v2H6v-2Zm0 7h8v2H6v-2Z" />
        </svg>
      );
    case 'PAYMENT':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={cls}>
          <path d="M4 8h16v8H4V8Zm2 2v4h12v-4H6Z" />
        </svg>
      );
    case 'DQC':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={cls}>
          <path d="m9 12 2 2 4-4 2 2-6 6-4-4 2-2Z M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" />
        </svg>
      );
    case 'MMT':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={cls}>
          <path d="M12 2 3 7v2h18V7L12 2Zm-7 9v7h3v-5h8v5h3v-7H5Z" />
        </svg>
      );
    case 'MEETING':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={cls}>
          <path d="M7 2v2H5a2 2 0 0 0-2 2v1h18V4a2 2 0 0 0-2-2h-2V2H7Zm14 7H3v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Z" />
        </svg>
      );
    case 'ASSIGNMENT':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={cls}>
          <path d="M16 11c1.66 0 3-1.34 3-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-3.5C15 13.17 10.33 12 8 12Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-3.5c0-2.33-4.67-3.5-7-3.5Z" />
        </svg>
      );
    case 'QUOTE':
    case 'QUOTATION':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={cls}>
          <path d="M7 3h10a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={cls}>
          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h3.1A1.5 1.5 0 0 0 17 18.5v-1.05A6 6 0 0 0 19 9V8a1 1 0 0 0-1-1h-1.17A5 5 0 0 0 7.17 7H6a1 1 0 0 0-1 1v1a6 6 0 0 0 2 8.45v1.05A1.5 1.5 0 0 0 8.45 20h3.1A2.5 2.5 0 0 0 12 22Zm0-15a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
        </svg>
      );
  }
}

export function formatNotificationTime(timeStr: string): string {
  if (!timeStr) return '';
  try {
    const d = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function formatNotificationFullTime(timeStr: string): string {
  if (!timeStr) return '';
  try {
    const d = new Date(timeStr);
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/** @deprecated use extractNotificationDetails */
export function formatNotificationPayload(payload: unknown): string {
  const rows = extractNotificationDetails({ payload } as DesignNotificationItem);
  return rows.map((r) => r.value).join(' · ');
}

export type NotificationFilterId =
  | 'all'
  | 'lead'
  | 'milestone'
  | 'payment'
  | 'meeting'
  | 'dqc'
  | 'mmt'
  | 'assignment'
  | 'quote';

export const NOTIFICATION_FILTERS: Array<{
  id: NotificationFilterId;
  label: string;
  types?: string[];
}> = [
  { id: 'all', label: 'All' },
  { id: 'lead', label: 'Leads', types: ['LEAD', 'PHASE'] },
  { id: 'milestone', label: 'Milestones', types: ['MILESTONE', 'P2P'] },
  { id: 'payment', label: 'Payments', types: ['PAYMENT'] },
  { id: 'meeting', label: 'Meetings', types: ['MEETING'] },
  { id: 'dqc', label: 'DQC', types: ['DQC', 'PM'] },
  { id: 'mmt', label: 'MMT', types: ['MMT'] },
  { id: 'assignment', label: 'Assign', types: ['ASSIGNMENT'] },
  { id: 'quote', label: 'Quote', types: ['QUOTE', 'QUOTATION'] },
];

/** Tabs visible per role — aligned with notification fan-out rules. */
export function notificationTabIdsForRole(role: string | null | undefined): NotificationFilterId[] {
  const r = (role || '').toLowerCase();
  if (r === 'finance') return ['all', 'payment'];
  if (r === 'dqc_manager' || r === 'dqe') return ['all', 'dqc'];
  if (r === 'mmt_manager' || r === 'mmt_executive') return ['all', 'mmt', 'assignment'];
  if (r === 'admin' || r === 'deputy_general_manager') {
    return ['all', 'lead', 'payment', 'dqc', 'assignment', 'quote', 'milestone'];
  }
  if (r === 'territorial_design_manager') {
    return ['all', 'lead', 'milestone', 'payment', 'dqc', 'assignment', 'quote'];
  }
  if (r === 'design_manager') {
    return NOTIFICATION_FILTERS.map((f) => f.id);
  }
  if (r === 'designer') {
    return NOTIFICATION_FILTERS.map((f) => f.id);
  }
  if (r === 'project_manager' || r === 'senior_project_manager') {
    return ['all', 'milestone', 'meeting', 'dqc', 'mmt', 'assignment'];
  }
  return NOTIFICATION_FILTERS.map((f) => f.id);
}

function payloadIsDqc2(item: DesignNotificationItem): boolean {
  const type = (item.notification_type || '').toUpperCase();
  if (type !== 'DQC') return false;
  const round = pick(asRecord(item.payload), ['dqc_round']).toUpperCase();
  return round.includes('2') || round.includes('ROUND_2') || round === 'DQC2';
}

function payloadIsD2Related(item: DesignNotificationItem): boolean {
  const type = (item.notification_type || '').toUpperCase();
  const action = (item.notification_action || '').toUpperCase();
  const p = asRecord(item.payload);
  if (type === 'PM' || type === 'P2P') return true;
  if (type === 'DQC' && payloadIsDqc2(item)) return true;
  if (type === 'ASSIGNMENT' && action === 'PM_ASSIGNED') return true;
  const milestoneIndex = Number(p.milestone_index ?? p.milestoneIndex);
  if (type === 'MILESTONE' && Number.isFinite(milestoneIndex) && milestoneIndex >= 3) return true;
  const mmtScope = pick(p, ['mmt_scope']).toUpperCase();
  const kind = pick(p, ['kind']).toUpperCase();
  if (type === 'MMT' && (mmtScope.includes('D2') || mmtScope.includes('MASKING') || kind.includes('D2'))) {
    return true;
  }
  if (type === 'MEETING') {
    const mt = pick(p, ['meeting_type', 'meetingType']).toLowerCase();
    return (
      mt.includes('sign') ||
      mt.includes('dqc2') ||
      mt.includes('d2') ||
      mt.includes('masking') ||
      mt.includes('sign-off') ||
      mt.includes('signoff') ||
      mt.includes('design sign')
    );
  }
  const pt = pick(p, ['payment_type', 'paymentType']).toUpperCase();
  if (type === 'PAYMENT' && pt.includes('40')) return true;
  return false;
}

function payloadIsMmtAssignment(item: DesignNotificationItem): boolean {
  const action = (item.notification_action || '').toUpperCase();
  const p = asRecord(item.payload);
  const assignmentType = pick(p, ['assignment_type']).toUpperCase();
  const kind = pick(p, ['kind']).toUpperCase();
  return (
    assignmentType.includes('MMT') ||
    kind.includes('MMT') ||
    kind.includes('D1_MMT') ||
    action === 'ASSIGNED'
  );
}

/** Client-side guard — inbox rows this role should see (matches backend fan-out). */
export function notificationVisibleForRole(
  item: DesignNotificationItem,
  role: string | null | undefined,
): boolean {
  const r = (role || '').toLowerCase();
  const type = (item.notification_type || '').toUpperCase();

  if (r === 'admin' || r === 'deputy_general_manager') {
    if (type === 'PAYMENT' || type === 'LEAD' || type === 'PHASE' || type === 'QUOTE' || type === 'QUOTATION') {
      return true;
    }
    if (type === 'ASSIGNMENT' && !payloadIsMmtAssignment(item)) return true;
    if (type === 'DQC' && payloadIsDqc2(item)) return true;
    if (type === 'P2P') return true;
    return false;
  }

  if (r === 'territorial_design_manager') {
    return (
      type === 'PAYMENT' ||
      type === 'MILESTONE' ||
      type === 'P2P' ||
      type === 'LEAD' ||
      type === 'PHASE' ||
      type === 'DQC' ||
      type === 'ASSIGNMENT' ||
      type === 'QUOTE' ||
      type === 'QUOTATION'
    );
  }

  if (r === 'finance') return type === 'PAYMENT' || type === 'P2P';
  if (r === 'dqc_manager' || r === 'dqe') return type === 'DQC' || type === 'P2P';
  if (r === 'mmt_manager' || r === 'mmt_executive') {
    return type === 'MMT' || type === 'P2P';
  }

  if (r === 'project_manager' || r === 'senior_project_manager') {
    return payloadIsD2Related(item) || type === 'P2P';
  }

  // design_manager, designer, and others: show what was delivered to their inbox
  return true;
}

export function matchesNotificationFilter(
  item: DesignNotificationItem,
  filterId: NotificationFilterId,
): boolean {
  if (filterId === 'all') return true;
  const filter = NOTIFICATION_FILTERS.find((f) => f.id === filterId);
  if (!filter?.types) return true;
  const type = (item.notification_type || '').toUpperCase();
  return filter.types.includes(type);
}

export function getCategoryLabel(type?: string): string {
  const key = (type || '').toUpperCase();
  const map: Record<string, string> = {
    LEAD: 'Lead',
    PHASE: 'Phase',
    MILESTONE: 'Milestone',
    PAYMENT: 'Payment',
    DQC: 'DQC',
    MMT: 'MMT',
    MEETING: 'Meeting',
    ASSIGNMENT: 'Assign',
    QUOTE: 'Quote',
    QUOTATION: 'Quote',
    P2P: 'P2P',
    PM: 'PM',
  };
  return map[key] || key || 'Update';
}

function humanizeLabel(raw: string): string {
  const s = String(raw || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (/^pre[_\s-]?10/.test(lower) || lower === 'pre 10%') return 'Pre-10%';
  if (/10.?20|phase.?10/.test(lower)) return '10–20%';
  if (/dqc1|first.?cut/.test(lower)) return 'DQC 1';
  if (/dqc2|sign.?off|signoff/.test(lower)) return 'DQC 2';
  if (/material/.test(lower)) return 'Material Selection';
  if (/showroom/.test(lower)) return 'Showroom Visit';
  if (/site.?visit/.test(lower)) return 'Site Visit';
  if (/virtual/.test(lower)) return 'Virtual Meeting';
  if (/in.?person/.test(lower)) return 'In Person';
  if (/pre.?10.?percent|10.?percent/.test(lower)) return '10% Payment';
  if (/40.?percent/.test(lower)) return '40% Payment';
  return s
    .split(' ')
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

function designerNameFrom(item: DesignNotificationItem, p: Record<string, unknown>): string {
  return pick(p, ['designer_name', 'designerName']);
}

function actorNameFrom(p: Record<string, unknown>): string {
  return pick(p, [
    'approver_name',
    'approverName',
    'approved_by',
    'approvedBy',
    'actor_name',
    'actorName',
    'assigned_by',
  ]);
}

function paymentTypeLabel(raw: string): string {
  const u = String(raw || '').toUpperCase();
  if (!u) return '';
  if (u.includes('SALES') || u.includes('CRM') || u.includes('CLOSURE') || u.includes('BOOKING')) {
    return 'Sales Closure Payment';
  }
  if (u.includes('40')) return '40% Design Payment';
  if (u.includes('10') || u.includes('PRE_10')) return '10% Design Payment';
  return humanizeLabel(raw);
}

function dqcRoundLabel(raw: string): string {
  const u = String(raw || '').toUpperCase();
  if (!u) return '';
  if (u.includes('2')) return 'DQC 2';
  if (u.includes('1')) return 'DQC 1';
  return humanizeLabel(raw);
}

function joinParts(parts: Array<string | false | null | undefined>): string {
  return parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(' · ');
}

export function getNotificationListTitle(item: DesignNotificationItem): string {
  const type = (item.notification_type || '').toUpperCase();
  const action = (item.notification_action || '').toUpperCase();
  const p = asRecord(item.payload);

  switch (type) {
    case 'LEAD':
      return 'New lead in Pre-10%';
    case 'PHASE':
      return 'Lead moved to 10–20%';
    case 'MILESTONE': {
      const milestone = humanizeLabel(pick(p, ['milestone_name', 'milestoneName']));
      return milestone ? `${milestone} completed` : 'Milestone completed';
    }
    case 'PAYMENT': {
      const pay = paymentTypeLabel(pick(p, ['payment_type', 'paymentType', 'milestone_context']));
      const decision = pick(p, ['decision_type', 'status']).toUpperCase();
      if (action === 'REQUESTED') return pay ? `${pay} requested` : 'Payment requested';
      if (decision === 'REJECTED' || action.includes('REJECT')) {
        return pay ? `${pay} rejected` : 'Payment rejected';
      }
      if (decision === 'APPROVED' || decision === 'SUCCESS') {
        return pay ? `${pay} approved` : 'Payment approved';
      }
      return pay ? `${pay} updated` : 'Payment status updated';
    }
    case 'DQC': {
      const round = dqcRoundLabel(pick(p, ['dqc_round', 'dqcRound'])) || 'DQC';
      if (action.includes('REQUEST')) return `${round} review requested`;
      const decision = pick(p, ['decision_type', 'status']).toUpperCase();
      if (decision === 'REJECTED') return `${round} rejected`;
      if (decision === 'APPROVED') return `${round} approved`;
      return `${round} status updated`;
    }
    case 'MMT':
      if (action.includes('DOC')) {
        const kind = pick(p, ['doc_kind']).toUpperCase() === 'D2' ? 'D2' : 'D1';
        return `${kind} documents ready — you can check now`;
      }
      if (action.includes('ASSIGN')) return 'MMT executive assigned';
      return 'Site measurement requested';
    case 'MEETING': {
      const mt = humanizeLabel(pick(p, ['meeting_type', 'meetingType']));
      return mt ? `${mt} scheduled` : 'Meeting scheduled';
    }
    case 'ASSIGNMENT':
      if (action.includes('PM')) return 'Project manager assigned';
      if (action === 'ASSIGNED') return 'MMT executive assigned';
      return 'Designer reassigned';
    case 'QUOTE':
    case 'QUOTATION':
      return 'New quotation saved';
    case 'P2P': {
      const designer = designerNameFrom(item, p);
      return designer
        ? `Congratulate ${designer} — lead completed`
        : 'Push to production completed — congratulations';
    }
    case 'PM': {
      const status = pick(p, ['status', 'decision_type']).toUpperCase();
      if (status.includes('REJECT')) return 'PM rejected DQC 2';
      return 'PM approved DQC 2';
    }
    default:
      return getNotificationHeadline(item);
  }
}

export function getNotificationSubtitle(item: DesignNotificationItem): string {
  const p = asRecord(item.payload);
  const type = (item.notification_type || '').toUpperCase();
  const action = (item.notification_action || '').toUpperCase();
  const lead = (item.lead_name || '').trim() || 'Unknown lead';
  const designer = designerNameFrom(item, p);
  const slot = formatSlot(p.slot);
  const visit = [pick(p, ['visit_date', 'visitDate']), pick(p, ['visit_time', 'visitTime'])]
    .filter(Boolean)
    .join(' ');

  if (type === 'LEAD') {
    return joinParts([
      lead,
      `Stage: ${humanizeLabel(pick(p, ['current_phase']) || 'PRE_10')}`,
      designer && `Designer: ${designer}`,
      pick(p, ['sales_executive_name', 'salesExecutiveName']) &&
        `Sales: ${pick(p, ['sales_executive_name', 'salesExecutiveName'])}`,
      humanizeLabel(pick(p, ['meeting_type', 'meetingType'])),
      slot,
    ]);
  }

  if (type === 'PHASE') {
    return joinParts([
      lead,
      `Stage: ${humanizeLabel(pick(p, ['current_phase', 'phase']) || 'PHASE_10_20')}`,
      pick(p, ['previous_phase']) && `From ${humanizeLabel(pick(p, ['previous_phase']))}`,
      designer && `Designer: ${designer}`,
      pick(p, ['message']),
    ]);
  }

  if (type === 'MILESTONE') {
    return joinParts([
      lead,
      humanizeLabel(pick(p, ['milestone_name', 'milestoneName'])),
      designer && `Designer: ${designer}`,
    ]);
  }

  if (type === 'PAYMENT' && action === 'REQUESTED') {
    return joinParts([
      lead,
      paymentTypeLabel(pick(p, ['payment_type', 'paymentType', 'milestone_context'])),
      designer && `Designer: ${designer}`,
      pick(p, ['upload_name', 'uploadName']),
      pick(p, ['amount']) && Number(pick(p, ['amount'])) > 0 && `₹${pick(p, ['amount'])}`,
    ]);
  }

  if (type === 'PAYMENT') {
    return joinParts([
      lead,
      paymentTypeLabel(pick(p, ['payment_type', 'paymentType', 'milestone_context'])),
      designer && `Designer: ${designer}`,
      actorNameFrom(p) && `By: ${actorNameFrom(p)}`,
      pick(p, ['rejection_reason', 'rejectionReason']) &&
        `Reason: ${pick(p, ['rejection_reason', 'rejectionReason'])}`,
      pick(p, ['amount']) && Number(pick(p, ['amount'])) > 0 && `₹${pick(p, ['amount'])}`,
    ]);
  }

  if (type === 'DQC' && action.includes('REQUEST')) {
    return joinParts([
      lead,
      dqcRoundLabel(pick(p, ['dqc_round', 'dqcRound'])),
      designer && `Designer: ${designer}`,
    ]);
  }

  if (type === 'DQC') {
    return joinParts([
      lead,
      dqcRoundLabel(pick(p, ['dqc_round', 'dqcRound'])),
      designer && `Designer: ${designer}`,
      actorNameFrom(p) && `By: ${actorNameFrom(p)}`,
      pick(p, ['rejection_reason', 'rejectionReason']) &&
        `Reason: ${pick(p, ['rejection_reason', 'rejectionReason'])}`,
    ]);
  }

  if (type === 'MMT' && action.includes('DOC')) {
    const kind = pick(p, ['doc_kind']).toUpperCase() === 'D2' ? 'D2' : 'D1';
    return joinParts([
      lead,
      pick(p, ['message']) || `${kind} documents uploaded — you can check them now`,
      designer && `Designer: ${designer}`,
      actorNameFrom(p) && `By: ${actorNameFrom(p)}`,
      pick(p, ['upload_name', 'uploadName']),
    ]);
  }

  if (type === 'MMT' && action.includes('ASSIGN')) {
    return joinParts([
      lead,
      pick(p, ['to_name', 'toName']) && `Executive: ${pick(p, ['to_name', 'toName'])}`,
      designer && `Designer: ${designer}`,
    ]);
  }

  if (type === 'MMT') {
    return joinParts([
      lead,
      visit && `Visit: ${visit}`,
      designer && `Designer: ${designer}`,
      pick(p, ['mmt_manager_name', 'mmtManagerName']) &&
        `MMT Mgr: ${pick(p, ['mmt_manager_name', 'mmtManagerName'])}`,
    ]);
  }

  if (type === 'MEETING') {
    return joinParts([
      lead,
      humanizeLabel(pick(p, ['meeting_type', 'meetingType'])),
      humanizeLabel(pick(p, ['mod', 'mode', 'meeting_mode'])),
      slot,
      designer && `Designer: ${designer}`,
    ]);
  }

  if (type === 'ASSIGNMENT' && action.includes('PM')) {
    return joinParts([
      lead,
      pick(p, ['to_name', 'toName']) && `PM: ${pick(p, ['to_name', 'toName'])}`,
      designer && `Designer: ${designer}`,
    ]);
  }

  if (type === 'ASSIGNMENT') {
    const from = pick(p, ['from_name', 'fromName']);
    const to = pick(p, ['to_name', 'toName']);
    return joinParts([
      lead,
      from && to ? `${from} → ${to}` : to && `→ ${to}`,
      designer && !to && `Designer: ${designer}`,
    ]);
  }

  if (type === 'QUOTE' || type === 'QUOTATION') {
    return joinParts([
      lead,
      pick(p, ['quote_id', 'quoteId', 'quotation_name']) &&
        `Quote ${pick(p, ['quote_id', 'quoteId', 'quotation_name'])}`,
      designer && `Designer: ${designer}`,
    ]);
  }

  if (type === 'PM') {
    return joinParts([
      lead,
      'DQC 2',
      designer && `Designer: ${designer}`,
      actorNameFrom(p) && `By: ${actorNameFrom(p)}`,
      pick(p, ['rejection_reason', 'rejectionReason']) &&
        `Reason: ${pick(p, ['rejection_reason', 'rejectionReason'])}`,
    ]);
  }

  if (type === 'P2P') {
    return joinParts([
      lead,
      designer && `Designer: ${designer}`,
      'Push to production done — congratulations',
    ]);
  }

  return joinParts([lead, designer && `Designer: ${designer}`, formatProjectLabel(item, p)]);
}

function formatProjectLabel(
  item: DesignNotificationItem,
  payload: Record<string, unknown>,
): string {
  const fromPayload = pick(payload, ['project_name', 'project_title', 'lead_title']);
  if (fromPayload) return fromPayload;

  const pid = (item.project_id || '').trim();
  if (!pid) return '';

  // Internal hub IDs are hard to scan in a list — show a short label instead.
  if (/^AL-[A-Z0-9]+$/i.test(pid)) return 'Design project';

  return pid.length > 36 ? `${pid.slice(0, 33)}…` : pid;
}

export type DateGroupId = 'today' | 'yesterday' | 'earlier';

export function getDateGroup(timeStr?: string): DateGroupId {
  if (!timeStr) return 'earlier';
  try {
    const d = new Date(timeStr);
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);
    if (d >= startToday) return 'today';
    if (d >= startYesterday) return 'yesterday';
    return 'earlier';
  } catch {
    return 'earlier';
  }
}

export function formatListTime(timeStr?: string): string {
  if (!timeStr) return '';
  try {
    const d = new Date(timeStr);
    const now = new Date();
    const group = getDateGroup(timeStr);
    if (group === 'yesterday') return 'Yesterday';
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (group === 'today' && diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export const DATE_GROUP_LABELS: Record<DateGroupId, string> = {
  today: 'TODAY',
  yesterday: 'YESTERDAY',
  earlier: 'EARLIER',
};
