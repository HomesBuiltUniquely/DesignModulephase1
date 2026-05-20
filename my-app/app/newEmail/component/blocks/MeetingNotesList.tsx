import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';
import { theme } from '../../theme';

export interface MeetingNotesProps {
  dateAndTime: string;
  attendees: string;
  discussionSummary?: string;
  keyDecisions?: string;
  nextSteps?: string;
}

export const MeetingNotesList = ({ 
  dateAndTime, 
  attendees, 
  discussionSummary,
  keyDecisions,
  nextSteps
}: MeetingNotesProps) => {
  return (
    <Section style={containerStyle}>
      <Text style={titleStyle}>MEETING NOTES</Text>
      <Section style={boxStyle}>
        
        {/* First two fields in one row */}
        <Row style={rowStyle}>
          <Column align="left" style={{ ...columnStyle, ...borderBottomStyle, width: '50%', borderRight: `1px solid ${theme.colors.neutral.lightGrey}` }}>
            <Text style={labelStyle}>DATE & TIME</Text>
            <Text style={valueStyle}>{dateAndTime}</Text>
          </Column>
          <Column align="left" style={{ ...columnStyle, ...borderBottomStyle, width: '50%' }}>
            <Text style={labelStyle}>ATTENDEES</Text>
            <Text style={valueStyle}>{attendees}</Text>
          </Column>
        </Row>

        {/* Discussion Summary in a separate section/row */}
        {discussionSummary && (
          <Row style={rowStyle}>
            <Column align="left" style={{ ...columnStyle, ...(keyDecisions || nextSteps ? borderBottomStyle : {}) }}>
              <Text style={labelStyle}>DISCUSSION SUMMARY</Text>
              <Text style={valueStyle}>{discussionSummary}</Text>
            </Column>
          </Row>
        )}

        {/* Key Decisions */}
        {keyDecisions && (
          <Row style={rowStyle}>
            <Column align="left" style={{ ...columnStyle, ...(nextSteps ? borderBottomStyle : {}) }}>
              <Text style={labelStyle}>KEY DECISIONS</Text>
              <Text style={valueStyle}>{keyDecisions}</Text>
            </Column>
          </Row>
        )}

        {/* Next Steps */}
        {nextSteps && (
          <Row style={rowStyle}>
            <Column align="left" style={columnStyle}>
              <Text style={labelStyle}>NEXT STEPS</Text>
              <Text style={valueStyle}>{nextSteps}</Text>
            </Column>
          </Row>
        )}

      </Section>
    </Section>
  );
};

const containerStyle = {
  width: '100%',
  padding: '24px',
};

const titleStyle = {
  margin: '0 0 12px 0',
  color: theme.colors.brand.primary,
  fontFamily: theme.fonts.body,
  fontSize: '12px',
  fontWeight: 'bold',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
};

const boxStyle = {
  width: '100%',
  backgroundColor: theme.colors.neutral.white,
  border: `1px solid ${theme.colors.neutral.lightGrey}`,
  borderLeft: `3px solid ${theme.colors.brand.primary}`,
  borderRadius: '4px',
};

const rowStyle = {
  width: '100%',
};

const borderBottomStyle = {
  borderBottom: `1px solid ${theme.colors.neutral.lightGrey}`,
};

const columnStyle = {
  padding: '16px',
  verticalAlign: 'top',
};

const labelStyle = {
  margin: '0 0 4px 0',
  color: theme.colors.neutral.mediumGrey,
  fontFamily: theme.fonts.body,
  fontSize: '11px',
  fontWeight: 'bold',
  letterSpacing: '0.5px',
  textTransform: 'uppercase' as const,
};

const valueStyle = {
  margin: '0',
  color: theme.colors.neutral.nearBlack,
  fontFamily: theme.fonts.body,
  fontSize: '14px',
  lineHeight: '1.5',
};
