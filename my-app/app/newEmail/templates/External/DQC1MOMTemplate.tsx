import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { Button } from '../../component/blocks/Button';
import { FileList, FileItem } from '../../component/blocks/FileList';
import { MeetingNotesList } from '../../component/blocks/MeetingNotesList';

export interface ProjectFileTimelineEmailProps {
  customerName?: string;
  projectId?: string;
  
  designerName?: string;
  meetingDate?: string;
  meetingTime?: string;
  attendees?: string;
  discussionSummary?: string;
  attachments?: FileItem[];
}

export default function ProjectFileTimelineEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  
  designerName = 'Your Design Consultant',
  meetingDate,
  meetingTime,
  attendees,
  discussionSummary,
  attachments = [],
}: ProjectFileTimelineEmailProps) {
  

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="PROJECT" status="MEETING SUMMARY" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          First Cut Design Meeting Summary
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          Please find below the official minutes of our First Cut Design meeting.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          Here is a summary of our discussion, including key decisions made and any reference files uploaded for your records.
        </Text>

        {(meetingDate || attendees || discussionSummary) && (
          <MeetingNotesList 
            dateAndTime={meetingDate && meetingTime ? `${meetingDate} • ${meetingTime}` : (meetingDate || 'N/A')}
            attendees={attendees || 'Customer, Designer'}
            discussionSummary={discussionSummary}
          />
        )}

        {attachments.length > 0 && (
          <FileList
            files={attachments.map((a) => ({
              name: (a as any).filename || (a as any).name || 'Document',
              meta: 'Uploaded Document',
              url: (a as any).path || (a as any).url,
            }))}
          />
        )}{/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          Looking forward to our continued collaboration.
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
