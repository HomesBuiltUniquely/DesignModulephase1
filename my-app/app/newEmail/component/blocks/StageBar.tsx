import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';
import { theme } from '../../theme';

interface StageBarProps {
  stageName: string;
  status: string;
}

export const StageBar = ({ stageName, status }: StageBarProps) => {
  return (
    <Section style={stageBarStyle}>
      <Row>
        <Column align="left">
          <Text style={stageNameStyle}>{stageName}</Text>
        </Column>
        <Column align="right" style={rightColumnStyle}>
          <Text style={statusStyle}>{status}</Text>
        </Column>
      </Row>
    </Section>
  );
};

const stageBarStyle = {
  backgroundColor: theme.colors.brand.lightBg,
  padding: '12px 24px',
  width: '100%',
};

const rightColumnStyle = {
  textAlign: 'right' as const,
};

const stageNameStyle = {
  margin: '0',
  color: theme.colors.brand.primary,
  fontFamily: theme.fonts.body,
  fontSize: '12px',
  fontWeight: 'bold',
  letterSpacing: '0.5px',
  textTransform: 'uppercase' as const,
};

const statusStyle = {
  margin: '0',
  color: theme.colors.brand.dark,
  fontFamily: theme.fonts.body,
  fontSize: '12px',
  fontWeight: 'bold',
  letterSpacing: '0.5px',
  textTransform: 'uppercase' as const,
};
