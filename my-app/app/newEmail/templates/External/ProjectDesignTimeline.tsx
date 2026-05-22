import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { Button } from '../../component/blocks/Button';
import { FileList } from '../../component/blocks/FileList';
import { MeetingNotesList } from '../../component/blocks/MeetingNotesList';

export interface ProjectDesignTimelineEmailProps {
  customerName?: string;
  projectId?: string;
  
  designerName?: string;
}

export default function ProjectDesignTimelineEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  
  designerName = 'Your Design Consultant',
}: ProjectDesignTimelineEmailProps) {
  

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="DESIGN" status="TIMELINE" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Project Design Timeline
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          We have prepared a detailed timeline for the design phase of your project.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          This schedule outlines the key milestones and review points.
        </Text>

        <MeetingNotesList 
          dateAndTime="October 24, 2025 • 10:00 AM"
          attendees="John Doe, Jane Smith"
          discussionSummary="Discussed the initial design options and layout preferences."
          keyDecisions="Selected Option A for the living room."
          nextSteps="Prepare final 3D renders for review."
        />

        <FileList files={[
          { name: 'Initial_Design_Concept.pdf', meta: 'PDF • 2.4 MB' },
          { name: 'Meeting_Minutes.pdf', meta: 'PDF • 1.1 MB' }
        ]} />
{/* Closing text */}
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
