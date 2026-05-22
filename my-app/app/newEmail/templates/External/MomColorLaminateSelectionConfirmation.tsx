import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { FileList } from '../../component/blocks/FileList';
import { MeetingNotesList } from '../../component/blocks/MeetingNotesList';
import { type LaminateSelections } from '@/lib/email/render-mom-color-laminate-selection-confirmation';

export interface MomColorLaminateSelectionConfirmationEmailProps {
  customerName?: string;
  projectId?: string;
  designerName?: string;
  meetingDate?: string;
  meetingTime?: string;
  attendees?: string;
  discussionSummary?: string;
  laminateSelections?: LaminateSelections | null;
  attachments?: any[];
}

export default function MomColorLaminateSelectionConfirmationEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  designerName = 'Your Design Consultant',
  meetingDate,
  meetingTime,
  attendees,
  discussionSummary,
  laminateSelections = {},
  attachments = [],
}: MomColorLaminateSelectionConfirmationEmailProps) {
  const k = laminateSelections?.kitchen ?? {};
  const mb = laminateSelections?.masterBedroom ?? {};
  const b2 = laminateSelections?.bedroom2 ?? {};
  const lr = laminateSelections?.livingRoom ?? {};

  const kitchenDetails: DetailItem[] = [
    { label: 'Base Shutters', value: k.baseShutters || '–' },
    { label: 'Wall Shutters', value: k.wallShutters || '–' },
    { label: 'Tall Units', value: k.tallUnits || '–' },
    { label: 'Internal Finish', value: k.internalFinish || '–' },
    { label: 'Hinges & Channels', value: k.hingesChannels || '–' },
    { label: 'Handles', value: k.handles || '–' },
  ];

  const mbDetails: DetailItem[] = [
    { label: 'Wardrobe Shutters', value: mb.wardrobeShutters || '–' },
    { label: 'Loft Finish', value: mb.loftFinish || '–' },
    { label: 'Internal Finish', value: mb.internalFinish || '–' },
    { label: 'Hinges & Channels', value: mb.hingesChannels || '–' },
    { label: 'Handles', value: mb.handles || '–' },
  ];

  const b2Details: DetailItem[] = [
    { label: 'Wardrobe Shutters', value: b2.wardrobeShutters || '–' },
    { label: 'Loft Finish', value: b2.loftFinish || '–' },
    { label: 'Internal Finish', value: b2.internalFinish || '–' },
    { label: 'Hinges & Channels', value: b2.hingesChannels || '–' },
    { label: 'Handles', value: b2.handles || '–' },
  ];

  const lrDetails: DetailItem[] = [
    { label: 'Base Finish', value: lr.baseFinish || '–' },
    { label: 'Highlight / Accent', value: lr.highlightAccent || '–' },
  ];

  const hasSelections = 
    Object.keys(k).length > 0 || 
    Object.keys(mb).length > 0 || 
    Object.keys(b2).length > 0 || 
    Object.keys(lr).length > 0;

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="MATERIAL SELECTION" status="CONFIRMATION" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Color & Laminate Selection Confirmed
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Thank you for visiting the Experience Center for the color and material selection discussion. Please find below the summary of the finalised laminate selections for your project:
        </Text>

        {(meetingDate || attendees || discussionSummary) && (
          <MeetingNotesList 
            dateAndTime={meetingDate && meetingTime ? `${meetingDate} • ${meetingTime}` : (meetingDate || 'N/A')}
            attendees={attendees || 'Customer, Designer'}
            discussionSummary={discussionSummary}
          />
        )}

        {hasSelections ? (
          <>
            {Object.keys(k).length > 0 && <DetailsList title="KITCHEN SELECTIONS" items={kitchenDetails} />}
            {Object.keys(mb).length > 0 && <DetailsList title="MASTER BEDROOM SELECTIONS" items={mbDetails} />}
            {Object.keys(b2).length > 0 && <DetailsList title="BEDROOM 2 SELECTIONS" items={b2Details} />}
            {Object.keys(lr).length > 0 && <DetailsList title="LIVING ROOM SELECTIONS" items={lrDetails} />}
          </>
        ) : (
          <Text className="m-0 text-[15px] leading-relaxed text-neutral-mediumGrey italic pb-4">
            No specific material options selected. Please see MOM details.
          </Text>
        )}

        {attachments && attachments.length > 0 && (
          <FileList 
            title="MOM DOCUMENTS" 
            files={attachments.map(a => ({
              name: a.filename || a.name || 'MOM Attachment',
              meta: 'MOM Document',
              url: a.path || a.url,
            }))} 
          />
        )}

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          We will now incorporate these selections into the final drawings and proceed towards DQC 2 submission. Looking forward to our continued collaboration.
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
