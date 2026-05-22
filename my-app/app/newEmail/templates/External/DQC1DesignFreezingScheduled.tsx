import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { Button } from '../../component/blocks/Button';

export interface DQC1DesignFreezingScheduledEmailProps {
  customerName?: string;
  projectId?: string;
  meetingDate?: string;
  meetingTime?: string;
  meetingMode?: 'online' | 'offline' | string;
  meetingLink?: string;
  branchName?: string;
  designerName?: string;
}

export default function DQC1DesignFreezingScheduledEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  meetingDate = 'October 24, 2025',
  meetingTime = '10:00 AM – 12:00 PM',
  meetingMode = 'online',
  meetingLink = '#',
  branchName = 'HUB Experience Center',
  designerName = 'Your Design Consultant',
}: DQC1DesignFreezingScheduledEmailProps) {
  const meetingDetails: DetailItem[] = [
    { label: 'Date', value: meetingDate },
    { label: 'Time', value: meetingTime },
  ];

  if (meetingMode === 'offline') {
    meetingDetails.push({ label: 'Location', value: `${branchName} Branch` });
  } else {
    meetingDetails.push({ label: 'Mode', value: 'Online Meeting' });
  }

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="DQC 1" status="MEETING SCHEDULED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Design Freezing Meeting Scheduled
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          It is time to freeze the initial design concepts for your space.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          Let's connect to finalize the layout and core design elements.
        </Text>

        {/* Meeting Details List */}
        <DetailsList title="MEETING DETAILS" items={meetingDetails} />

        {/* CTA Button / Location Note */}
        {meetingMode === 'online' ? (
          <div className="text-center mt-6 mb-6">
            <Button text="JOIN MEETING" href={meetingLink || '#'} />
          </div>
        ) : (
          <Section className="bg-neutral-nearWhite border border-neutral-lightGrey rounded p-4 my-6 text-center">
            <Text className="m-0 text-[14px] text-neutral-nearBlack">
              We look forward to hosting you at our <span className="font-bold">{branchName} Branch</span> for the presentation.
            </Text>
          </Section>
        )}

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          During this meeting, we will:
        </Text>
        <ul className="m-0 ml-4 p-0 text-[14px] leading-relaxed text-neutral-nearBlack pb-4">
          <li className="mb-1">Review spatial planning and layouts</li>
          <li className="mb-1">Confirm core design concepts</li>
          <li className="mb-1">Freeze preliminary design</li>
        </ul>

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          I hope this schedule works for you. In case of any constraints, please feel free to let me know. Looking forward to our continued collaboration.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{designerName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interiors</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
