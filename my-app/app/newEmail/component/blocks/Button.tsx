import * as React from 'react';
import { Button as ReactEmailButton, Section } from '@react-email/components';
import { theme } from '../../theme';

export interface ButtonProps {
  text: string;
  href: string;
}

export const Button = ({ text, href }: ButtonProps) => {
  return (
    <Section style={containerStyle}>
      <ReactEmailButton href={href} style={buttonStyle}>
        {text}
      </ReactEmailButton>
    </Section>
  );
};

const containerStyle = {
  width: '100%',
  textAlign: 'left' as const, // Aligning left based on typical email flow, but can be centered if needed
  padding: '16px 24px',
};

const buttonStyle = {
  backgroundColor: theme.colors.neutral.white,
  border: `1px solid ${theme.colors.neutral.mediumGrey}`, // Using medium grey for visibility, can use lightGrey if preferred
  borderRadius: '8px',
  color: theme.colors.neutral.nearBlack,
  fontFamily: theme.fonts.body,
  fontSize: '14px',
  fontWeight: 'bold',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  padding: '12px 24px',
  textDecoration: 'none',
  display: 'inline-block',
};
