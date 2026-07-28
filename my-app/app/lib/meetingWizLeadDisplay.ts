import type { LeadshipTypes } from '@/app/Components/Types/Types';
import { formatHubPid } from '@/app/lib/formatHubPid';

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function dash(v: string | null | undefined): string {
  return v?.trim() || '—';
}

/** Client / project fields for Meeting Wizard Intro (same sources as View modal). */
export function getMeetingWizLeadDisplay(lead: LeadshipTypes | null | undefined) {
  if (!lead) {
    return {
      hubPid: '—',
      customerName: 'Client',
      projectName: 'your project',
      configuration: '—',
      propertyType: '—',
      propertyLocation: '—',
      budget: '—',
      phone: '—',
      email: '—',
      experienceCenter: '—',
      timeSlot: '—',
      meetingDate: '—',
      designerName: 'Designer',
      designerTitle: 'Interior Designer',
      designerBranch: '—',
      phase: '—',
    };
  }

  const scope = lead.configScopeSummary ?? null;
  const customerName =
    trimOrNull(lead.intakeCustomerName) ||
    trimOrNull(scope?.familyContactName) ||
    trimOrNull(lead.projectName) ||
    'Client';

  const projectName =
    trimOrNull(lead.projectName) ||
    trimOrNull(scope?.propertyName) ||
    'your project';

  const configuration =
    trimOrNull(lead.intakeConfiguration) ||
    (scope?.selectedRoomNames?.length ? scope.selectedRoomNames.join(', ') : null) ||
    null;

  const propertyType =
    trimOrNull(lead.intakeBookingType) ||
    trimOrNull(scope?.bookingType) ||
    trimOrNull(scope?.designStylePreference) ||
    null;

  const timeSlot =
    trimOrNull(lead.scheduledMeetingSlot) ||
    trimOrNull(lead.appointmentSlot) ||
    null;

  const meetingDate =
    trimOrNull(lead.scheduledMeetingDate) ||
    trimOrNull(lead.appointmentDate) ||
    null;

  return {
    hubPid: formatHubPid(lead.pid, lead.id) || String(lead.id),
    customerName,
    projectName,
    configuration: dash(configuration),
    propertyType: dash(propertyType),
    propertyLocation: dash(lead.intakePropertyLocation),
    budget: dash(lead.intakeBudget),
    phone: dash(lead.contactNo),
    email: dash(lead.clientEmail),
    experienceCenter: dash(
      lead.experienceCenter || lead.experience_center || lead.sales_closure_ec || lead.branch,
    ),
    timeSlot: dash(timeSlot),
    meetingDate: dash(meetingDate),
    designerName: trimOrNull(lead.designerName) || 'Designer',
    designerTitle: 'Interior Designer',
    designerBranch: dash(lead.branch || lead.experienceCenter),
    phase: dash(lead.projectStage || lead.currentMilestoneName),
  };
}

export function buildMeetingAgendaTimes(timeSlotLabel: string | null | undefined): string[] {
  const raw = (timeSlotLabel || '').trim();
  // Try first clock time in the slot text (e.g. "4:30 PM - 6:00 PM" or "16:30")
  const match = raw.match(/(\d{1,2}:\d{2}\s*[AP]M|\d{1,2}:\d{2})/i);
  if (!match) return ['—', '—', '—'];
  const start = match[1].trim();
  return [start, '—', '—'];
}
