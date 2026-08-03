import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';

export interface MeetingNotesProps {
  dateAndTime?: string;
  attendees?: string;
  discussionSummary?: string;
}

export const MeetingNotesList = ({ 
  discussionSummary,
}: MeetingNotesProps) => {
  return (
    <Section className="w-full mb-6">
      <Text className="m-0 mb-3 text-brand-primary font-sans text-[12px] font-bold tracking-widest uppercase">
        MEETING NOTES
      </Text>
      <Section className="w-full bg-neutral-white border border-neutral-lightGrey border-l-4 border-l-brand-primary rounded">
        
        {/* Discussion Summary in a separate section/row */}
        {discussionSummary && (
          <Row className="w-full">
            <Column align="left" className="px-4 py-3 align-top">
              <Text className="m-0 mb-1 text-neutral-mediumGrey font-sans text-[11px] font-bold tracking-wider uppercase">DISCUSSION SUMMARY</Text>
              <Text className="m-0 text-neutral-nearBlack font-sans text-[14px] leading-relaxed">{discussionSummary}</Text>
            </Column>
          </Row>
        )}

      </Section>
    </Section>
  );
};
