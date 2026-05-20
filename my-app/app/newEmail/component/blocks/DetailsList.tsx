import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';
import { theme } from '../../theme';

export interface DetailItem {
  label: string;
  value: string | React.ReactNode;
}

export interface DetailsListProps {
  title?: string;
  items: DetailItem[];
}

export const DetailsList = ({ title = 'MEETING DETAILS', items }: DetailsListProps) => {
  return (
    <Section style={containerStyle}>
      {title && <Text style={titleStyle}>{title}</Text>}
      <Section style={boxStyle}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const colBorderStyle = isLast 
            ? {} 
            : { borderBottom: `1px solid ${theme.colors.neutral.lightGrey}` };

          return (
            <Row key={index} style={rowStyle}>
              <Column align="left" style={{ ...leftColumnStyle, ...colBorderStyle }}>
                <Text style={labelStyle}>{item.label}</Text>
              </Column>
              <Column align="right" style={{ ...rightColumnStyle, ...colBorderStyle }}>
                <Text style={valueStyle}>{item.value}</Text>
              </Column>
            </Row>
          );
        })}
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

const leftColumnStyle = {
  padding: '12px 16px',
  width: '40%',
  verticalAlign: 'middle',
};

const rightColumnStyle = {
  padding: '12px 16px',
  textAlign: 'right' as const,
  width: '60%',
  verticalAlign: 'middle',
};

const labelStyle = {
  margin: '0',
  color: theme.colors.neutral.mediumGrey,
  fontFamily: theme.fonts.body,
  fontSize: '14px',
};

const valueStyle = {
  margin: '0',
  color: theme.colors.neutral.nearBlack,
  fontFamily: theme.fonts.body,
  fontSize: '14px',
  fontWeight: '500',
};
