import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface MeetingCancelledEmailProps {
  customerName?: string;
  projectId?: string;
  meetingTypeLabel?: string;
  meetingDate?: string;
  meetingTime?: string;
  reason?: string;
  designerName?: string;
}

export default function MeetingCancelledEmail({
  customerName = 'Customer',
  projectId = '',
  meetingTypeLabel = 'Design Meeting',
  meetingDate = '',
  meetingTime = '',
  reason = '',
  designerName = 'Your Design Consultant',
}: MeetingCancelledEmailProps) {
  const details: DetailItem[] = [
    { label: 'Meeting', value: meetingTypeLabel },
    ...(meetingDate ? [{ label: 'Scheduled Time', value: `${meetingDate}${meetingTime ? ` at ${meetingTime}` : ''}` }] : []),
    ...(reason ? [{ label: 'Reason', value: reason }] : []),
    { label: 'Status', value: 'Cancelled' },
    { label: 'Designer', value: designerName },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="MEETING" status="CANCELLED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Meeting Cancellation Notice
        </Text>

        {/* Intro */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Please be informed that your <strong>{meetingTypeLabel}</strong> scheduled for{' '}
          <strong>{meetingDate}{meetingTime ? ` at ${meetingTime}` : ''}</strong> has been cancelled.
        </Text>

        {/* Cancellation Alert Banner */}
        <Section className="w-full mb-6 rounded border border-[#fecaca] bg-[#fef2f2] border-l-4 border-l-[#EF0101] p-4">
          <Text className="m-0 text-[14px] font-bold text-[#991b1b] mb-1">Meeting Cancelled</Text>
          <Text className="m-0 text-[13px] leading-relaxed text-[#7f1d1d]">
            {reason
              ? `Reason: ${reason}`
              : 'This session has been removed from the schedule. Our design team will reach out to reschedule or assist you with next steps.'}
          </Text>
        </Section>

        {/* Details List */}
        <DetailsList title="DETAILS" items={details} />

        {/* Next Steps text */}
        <Text className="m-0 mt-6 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          If you wish to reschedule this appointment or have any questions regarding your project, please feel free to reach out to us or your designer.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{designerName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interior</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}
