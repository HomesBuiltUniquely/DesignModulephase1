import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export type MeetingUpdateAction = 'rescheduled' | 'cancelled';

export interface MeetingUpdateEmailProps {
  action?: MeetingUpdateAction;
  customerName?: string;
  projectId?: string;
  meetingTypeLabel?: string;
  stageName?: string;
  meetingDate?: string;
  meetingTime?: string;
  previousMeetingDate?: string;
  previousMeetingTime?: string;
  meetingMode?: 'online' | 'offline' | string;
  meetingLink?: string;
  branchName?: string;
  designerName?: string;
  reason?: string;
}

function stageForMeetingType(meetingTypeLabel?: string): string {
  const key = String(meetingTypeLabel || '').toLowerCase();
  if (key.includes('first cut')) return 'DQC 1 · FIRST CUT DESIGN';
  if (key.includes('material')) return 'DQC 2 · MATERIAL SELECTION';
  if (key.includes('sign')) return 'DESIGN SIGN-OFF';
  if (key.includes('pre 10') || key.includes('pre10')) return 'PRE 10%';
  return 'DESIGN MEETING';
}

export default function MeetingUpdateEmail({
  action = 'rescheduled',
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  meetingTypeLabel = 'Design meeting',
  stageName,
  meetingDate = 'Date to be confirmed',
  meetingTime = 'Time to be confirmed',
  previousMeetingDate,
  previousMeetingTime,
  meetingMode = 'online',
  branchName = 'HUB Experience Center',
  designerName = 'Your Design Consultant',
  reason = '',
}: MeetingUpdateEmailProps) {
  const isCancel = action === 'cancelled';
  const stage = stageName || stageForMeetingType(meetingTypeLabel);
  const status = isCancel ? 'MEETING CANCELLED' : 'MEETING RESCHEDULED';
  const title = isCancel ? 'Meeting Cancelled' : 'Meeting Rescheduled';

  const details: DetailItem[] = [
    { label: 'Meeting', value: meetingTypeLabel },
  ];

  if (!isCancel && previousMeetingDate) {
    details.push({
      label: 'Previous slot',
      value: previousMeetingTime ? `${previousMeetingDate} · ${previousMeetingTime}` : previousMeetingDate,
    });
  }

  details.push({ label: isCancel ? 'Cancelled date' : 'New date', value: meetingDate });
  details.push({ label: isCancel ? 'Cancelled time' : 'New time', value: meetingTime });

  if (meetingMode === 'offline') {
    details.push({ label: 'Location', value: `${branchName}` });
  } else {
    details.push({ label: 'Mode', value: 'Online Meeting' });
  }

  if (reason) {
    details.push({ label: 'Reason', value: reason });
  }

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName={stage} status={status} />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          {title}
        </Text>

        {isCancel ? (
          <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
            Your <strong>{meetingTypeLabel}</strong> meeting has been cancelled. Please review the details below.
            Your designer will help you book a new slot if needed.
          </Text>
        ) : (
          <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
            Your <strong>{meetingTypeLabel}</strong> meeting has been moved to a new date and time. Please use the
            updated slot below for your visit.
          </Text>
        )}

        {isCancel ? (
          <Section className="w-full mb-6 rounded border border-[#fecaca] bg-[#fef2f2] border-l-4 border-l-[#EF0101] p-4">
            <Text className="m-0 text-[14px] font-bold text-[#991b1b] mb-1">This meeting will not take place</Text>
            <Text className="m-0 text-[13px] leading-relaxed text-[#7f1d1d]">
              Please ignore any earlier calendar invite for this cancelled slot. Reach out to your designer if you need
              to schedule again.
            </Text>
          </Section>
        ) : (
          <Section className="w-full mb-6 rounded border border-[#bbf7d0] bg-[#f0fdf4] border-l-4 border-l-[#16a34a] p-4">
            <Text className="m-0 text-[14px] font-bold text-[#166534] mb-1">Please use the new slot</Text>
            <Text className="m-0 text-[13px] leading-relaxed text-[#14532d]">
              The previous meeting time is no longer valid. Kindly join or visit at the new date and time shown below.
            </Text>
          </Section>
        )}

        <DetailsList title="MEETING DETAILS" items={details} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pt-4 pb-8">
          If this change does not work for you, please reply to this email or contact your designer so we can help.
        </Text>

        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{designerName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interior</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}
