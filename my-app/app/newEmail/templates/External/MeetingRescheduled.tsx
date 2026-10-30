import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { Button } from '../../component/blocks/Button';

export interface MeetingRescheduledEmailProps {
  customerName?: string;
  projectId?: string;
  meetingTypeLabel?: string;
  previousDate?: string;
  previousTime?: string;
  newDate?: string;
  newTime?: string;
  meetingMode?: 'online' | 'offline' | string;
  meetingLink?: string;
  branchName?: string;
  designerName?: string;
}

export default function MeetingRescheduledEmail({
  customerName = 'Customer',
  projectId = '',
  meetingTypeLabel = 'Design Meeting',
  previousDate = '',
  previousTime = '',
  newDate = '',
  newTime = '',
  meetingMode = 'offline',
  meetingLink = '',
  branchName = 'HUB Experience Center',
  designerName = 'Your Design Consultant',
}: MeetingRescheduledEmailProps) {
  const isOnline = String(meetingMode || '').toLowerCase().includes('online') || String(meetingMode || '').toLowerCase().includes('virtual');

  const meetingDetails: DetailItem[] = [
    { label: 'Meeting', value: meetingTypeLabel },
    ...(previousDate ? [{ label: 'Previous Schedule', value: `${previousDate}${previousTime ? ` at ${previousTime}` : ''}` }] : []),
    { label: 'New Schedule', value: `${newDate}${newTime ? ` at ${newTime}` : ''}` },
  ];

  if (isOnline) {
    meetingDetails.push({ label: 'Mode', value: 'Online / Virtual Meeting' });
  } else if (branchName) {
    meetingDetails.push({ label: 'Location', value: branchName });
  }

  meetingDetails.push({ label: 'Designer', value: designerName });

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="MEETING" status="RESCHEDULED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          {meetingTypeLabel.startsWith('Meeting Rescheduled') ? meetingTypeLabel : 'Your Meeting Has Been Rescheduled'}
        </Text>

        {/* Intro */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Please be informed that your upcoming <strong>{meetingTypeLabel}</strong> has been rescheduled to a new time.
        </Text>

        {/* Details Card */}
        <DetailsList title="UPDATED MEETING DETAILS" items={meetingDetails} />

        {/* Online CTA or Offline venue notes */}
        {isOnline && meetingLink ? (
          <div className="text-center mt-6 mb-6">
            <Button text="JOIN MEETING" href={meetingLink} />
          </div>
        ) : !isOnline && branchName ? (
          <Section className="bg-neutral-nearWhite border border-neutral-lightGrey rounded p-4 my-6 text-center">
            <Text className="m-0 text-[14px] text-neutral-nearBlack">
              We look forward to meeting you at our <span className="font-bold">{branchName}</span>.
            </Text>
          </Section>
        ) : null}

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          If you have any questions or this updated slot does not work for you, please let us know so we can accommodate your schedule.
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
